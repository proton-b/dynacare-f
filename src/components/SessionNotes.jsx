import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { noteService, aiService, imageService, patientService, recordingService, assessmentService, sessionService } from '../services/api'
import ImageAnnotationOverlay from './ImageAnnotationOverlay'
import { exportClinicalSummaryToPDF } from '../utils/pdfExport'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const API_URL = import.meta.env.VITE_BACKEND_URL

const SessionNotes = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('editor')
    const [noteContent, setNoteContent] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [transcriptData, setTranscriptData] = useState(null)
    const [aiSummary, setAiSummary] = useState(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
    const [isSymptomReportLoading, setIsSymptomReportLoading] = useState(false)
    const [symptomReport, setSymptomReport] = useState(null)
    const [libraryImages, setLibraryImages] = useState([])
    const [isImagePickerOpen, setIsImagePickerOpen] = useState(false)
    const [charCount, setCharCount] = useState(0)
    const [annotationOverlay, setAnnotationOverlay] = useState(null)
    const [patients, setPatients] = useState([])
    const [selectedPatientId, setSelectedPatientId] = useState(location.state?.patientId || '')
    const [savedNotes, setSavedNotes] = useState([])
    const [notesLoading, setNotesLoading] = useState(false)
    const [viewingNote, setViewingNote] = useState(null)
    const [exportFormat, setExportFormat] = useState('PDF')

    // Edit past note state
    const [editingNoteId, setEditingNoteId] = useState(null)
    const [patientSessions, setPatientSessions] = useState([]) // notes for selected patient
    const [selectedSessionId, setSelectedSessionId] = useState('')
    const [patientRecordingsMap, setPatientRecordingsMap] = useState([]) // recordings for selected patient

    // Connected session flow state
    const [currentSessionId, setCurrentSessionId] = useState(location.state?.sessionId || null)
    const [currentRecordingId, setCurrentRecordingId] = useState(location.state?.recordingId || null)
    const [apiSessions, setApiSessions] = useState([]) // sessions from the sessions API

    // Assessment state
    const [assessmentLink, setAssessmentLink] = useState('')
    const [assessmentLinkLoading, setAssessmentLinkLoading] = useState(false)
    const [assessmentResponses, setAssessmentResponses] = useState([])   // PHQ9
    const [gad7Responses, setGad7Responses] = useState([])
    const [pcl5Responses, setPcl5Responses] = useState([])
    const [auditResponses, setAuditResponses] = useState([])
    const [cageResponses, setCageResponses] = useState([])
    const [mdqResponses, setMdqResponses] = useState([])
    const [assessmentResponsesLoading, setAssessmentResponsesLoading] = useState(false)
    const [linkCopied, setLinkCopied] = useState(false)
    const [assessmentMenuOpen, setAssessmentMenuOpen] = useState(null)
    const [chartFilter, setChartFilter] = useState('all')
    const [chartXAxis, setChartXAxis] = useState('attempt') // 'attempt' or 'date'

    // Export tab state
    const [exportSelectedNoteId, setExportSelectedNoteId] = useState('current')
    const [exportIncludeReport, setExportIncludeReport] = useState(true)

    // Upload audio states
    const [uploadFile, setUploadFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStep, setUploadStep] = useState('')
    const [clinicalSummary, setClinicalSummary] = useState(null)
    const [showSummaryModal, setShowSummaryModal] = useState(false)
    const [generatingSummary, setGeneratingSummary] = useState(false)

    const editorRef = useRef(null)
    const savedSelectionRef = useRef(null)
    const fileInputRef = useRef(null)
    const noteViewContentRef = useRef(null)

    const [expandedSessionId, setExpandedSessionId] = useState(null)
    const [expandedSessionSection, setExpandedSessionSection] = useState(null) // 'notes'|'transcript'|'report'|'audio'|'scores'

    const getImageUrl = (imageUrl) => {
        if (!imageUrl) return ''
        if (imageUrl.startsWith('http')) return imageUrl
        const baseUrl = API_URL.replace('/api', '')
        return `${baseUrl}${imageUrl}`
    }

    const getAudioUrl = (audioUrl, recordingId) => {
        if (!audioUrl) return ''
        if (recordingId) {
            const token = localStorage.getItem('token')
            return `${API_URL}/recordings/${recordingId}/stream?token=${token}`
        }
        if (audioUrl.startsWith('http')) return audioUrl
        const baseUrl = API_URL.replace('/api', '')
        return `${baseUrl}${audioUrl}`
    }

    const handleDownloadAudio = (recordingId, format) => {
        const token = localStorage.getItem('token')
        const url = `${API_URL}/recordings/${recordingId}/stream?download=true&token=${token}`
        const a = document.createElement('a')
        a.href = url
        a.download = `recording_${recordingId}.${format || 'mp3'}`
        a.click()
    }

    useEffect(() => {
        const fetchLibraryImages = async () => {
            try {
                const response = await imageService.getAll()
                setLibraryImages(response.data)
            } catch (error) {
                console.error('Error fetching library images:', error)
            }
        }
        fetchLibraryImages()

        const fetchPatients = async () => {
            try {
                const response = await patientService.getAll()
                const data = Array.isArray(response.data) ? response.data : []
                setPatients(data)
                if (!selectedPatientId && data.length > 0) {
                    setSelectedPatientId(String(data[0].id))
                }
            } catch (error) {
                console.error('Error fetching patients:', error)
            }
        }
        fetchPatients()
        fetchSavedNotes()
    }, [])

    // Fetch past notes and recordings when patient changes
    useEffect(() => {
        if (!selectedPatientId) {
            setPatientSessions([])
            setPatientRecordingsMap([])
            setSelectedSessionId('')
            setEditingNoteId(null)
            return
        }
        const fetchPatientData = async () => {
            try {
                const [notesRes, recRes, sessRes] = await Promise.all([
                    noteService.getByPatientId(selectedPatientId),
                    recordingService.getByPatientId(selectedPatientId),
                    sessionService.getByPatientId(selectedPatientId)
                ])
                setPatientSessions(notesRes.data || [])
                setPatientRecordingsMap(recRes.data || [])
                setApiSessions(sessRes.data || [])
            } catch (err) {
                console.error('Error fetching patient sessions:', err)
            }
        }
        fetchPatientData()
        // Clear session selection when patient changes
        setSelectedSessionId('')
        setEditingNoteId(null)
    }, [selectedPatientId])

    // Load note + matching recording when session is selected
    useEffect(() => {
        if (!selectedSessionId) return
        const note = patientSessions.find(n => String(n.id) === String(selectedSessionId))
        if (!note) return

        // Load note content into editor
        if (editorRef.current) {
            editorRef.current.innerHTML = note.content || ''
            setNoteContent(note.content || '')
        }

        // Load AI insights
        if (note.ai_insights) {
            try {
                const insights = typeof note.ai_insights === 'string' ? JSON.parse(note.ai_insights) : note.ai_insights
                setAiSummary(insights)
                setClinicalSummary(insights)
            } catch {
                setAiSummary(null)
                setClinicalSummary(null)
            }
        } else {
            setAiSummary(null)
            setClinicalSummary(null)
        }

        // Find matching recording (closest in time, within 30 min window)
        const noteTime = new Date(note.created_at).getTime()
        const matchingRec = patientRecordingsMap.find(r => {
            const recTime = new Date(r.created_at).getTime()
            return Math.abs(recTime - noteTime) < 30 * 60 * 1000
        })
        if (matchingRec?.transcript) {
            setTranscriptData(matchingRec.transcript)
        } else {
            setTranscriptData(null)
        }

        // If the recording has a summary but note doesn't have ai_insights, use recording's
        if (!note.ai_insights && matchingRec?.summary) {
            try {
                const summary = typeof matchingRec.summary === 'string' ? JSON.parse(matchingRec.summary) : matchingRec.summary
                setAiSummary(summary)
                setClinicalSummary(summary)
            } catch {}
        }

        setEditingNoteId(note.id)
        setActiveTab('editor')
    }, [selectedSessionId])

    // Handler to start a new note (clear editing state)
    const handleNewNote = () => {
        setEditingNoteId(null)
        setSelectedSessionId('')
        setNoteContent('')
        setAiSummary(null)
        setClinicalSummary(null)
        setTranscriptData(null)
        setSymptomReport(null)
        setCurrentSessionId(null)
        setCurrentRecordingId(null)
        if (editorRef.current) {
            editorRef.current.innerHTML = ''
        }
        setActiveTab('editor')
    }

    // Save cursor position before opening image picker
    const saveSelection = () => {
        const sel = window.getSelection()
        if (sel.rangeCount > 0) {
            savedSelectionRef.current = sel.getRangeAt(0).cloneRange()
        }
    }

    // Restore cursor position
    const restoreSelection = () => {
        if (savedSelectionRef.current) {
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(savedSelectionRef.current)
        }
    }

    // Get editor text content for character count and save
    const getEditorContent = useCallback(() => {
        if (!editorRef.current) return ''
        return editorRef.current.innerHTML
    }, [])

    const getEditorTextContent = useCallback(() => {
        if (!editorRef.current) return ''
        return editorRef.current.innerText || ''
    }, [])

    // Insert image inline at cursor position
    const handleInsertImage = (image) => {
        const editor = editorRef.current
        if (!editor) return

        // Restore saved cursor position
        restoreSelection()

        // Focus editor
        editor.focus()

        const imgHtml = `<div contenteditable="false" style="margin: 12px 0; text-align: center;"><div style="display: inline-block; position: relative;" data-image-id="${image.id}" data-annotations="[]"><img src="${getImageUrl(image.image_url)}" alt="${image.label || image.original_name}" style="display: block; max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer;" title="Click to add labels" /><div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${image.label || image.original_name} — click to annotate</div></div></div><p><br></p>`

        const sel = window.getSelection()
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            range.deleteContents()

            const temp = document.createElement('div')
            temp.innerHTML = imgHtml
            const frag = document.createDocumentFragment()
            let lastNode
            while (temp.firstChild) {
                lastNode = frag.appendChild(temp.firstChild)
            }
            range.insertNode(frag)

            // Move cursor after the inserted content
            if (lastNode) {
                const newRange = document.createRange()
                newRange.setStartAfter(lastNode)
                newRange.collapse(true)
                sel.removeAllRanges()
                sel.addRange(newRange)
            }
        } else {
            // No selection, append at end
            editor.innerHTML += imgHtml
        }

        setNoteContent(getEditorContent())
        setCharCount(getEditorTextContent().length)
        setIsImagePickerOpen(false)
    }

    const handleFormat = (type) => {
        const editor = editorRef.current
        if (!editor) return
        editor.focus()

        switch (type) {
            case 'bold': document.execCommand('bold', false, null); break;
            case 'italic': document.execCommand('italic', false, null); break;
            case 'underline': document.execCommand('underline', false, null); break;
            case 'list': document.execCommand('insertUnorderedList', false, null); break;
            default: break;
        }

        setNoteContent(getEditorContent())
    }

    const handleEditorInput = () => {
        setNoteContent(getEditorContent())
        setCharCount(getEditorTextContent().length)
    }

    // Handle paste - strip formatting except images
    const handleEditorPaste = (e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
    }

    // Click handler for images in the editor — opens annotation overlay
    const handleEditorClick = useCallback((e) => {
        // Find the closest image or annotation overlay element
        const clickedImg = e.target.tagName === 'IMG' ? e.target : null
        const clickedOverlay = e.target.closest('.annotation-overlay')

        if (!clickedImg && !clickedOverlay) return

        const wrapper = (clickedImg || clickedOverlay).closest('div[data-image-id]')
        if (!wrapper) return

        e.preventDefault()
        e.stopPropagation()

        const imageId = wrapper.getAttribute('data-image-id')
        const existingAnnotations = wrapper.getAttribute('data-annotations')
        let annotations = []
        try {
            annotations = existingAnnotations ? JSON.parse(existingAnnotations) : []
        } catch (err) {
            annotations = []
        }

        // Find the image src — it might be in annotation-overlay or directly in wrapper
        const img = wrapper.querySelector('img')
        if (!img) return

        setAnnotationOverlay({
            imageSrc: img.src,
            imageId,
            imageLabel: img.alt || '',
            annotations,
            targetElement: wrapper
        })
    }, [])

    useEffect(() => {
        const editor = editorRef.current
        if (!editor) return
        if (noteContent && !editor.innerHTML) {
            editor.innerHTML = noteContent
        }
        editor.addEventListener('click', handleEditorClick)
        return () => editor.removeEventListener('click', handleEditorClick)
    }, [handleEditorClick, activeTab])

    // Save annotations back into the editor DOM
    const handleAnnotationSave = useCallback((annotations) => {
        if (!annotationOverlay) return

        let wrapper = annotationOverlay.targetElement
        // Verify wrapper is still in the editor
        if (!editorRef.current?.contains(wrapper)) {
            wrapper = editorRef.current?.querySelector(`div[data-image-id="${annotationOverlay.imageId}"]`)
        }
        if (!wrapper) { setAnnotationOverlay(null); return }

        // Store annotations data
        wrapper.setAttribute('data-annotations', JSON.stringify(annotations))

        // Extract the bare <img> — it may be inside .annotation-overlay or directly in wrapper
        const existingOverlay = wrapper.querySelector('.annotation-overlay')
        let img = wrapper.querySelector('img')
        if (!img) { setAnnotationOverlay(null); return }

        // Get a clean img element (clone to strip from old parent)
        const cleanImg = img.cloneNode(true)
        cleanImg.style.cssText = 'display:block;max-width:100%;max-height:400px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;'
        cleanImg.title = ''

        // Remove the old overlay and legend if they exist
        if (existingOverlay) {
            existingOverlay.remove()
        }
        const existingLegend = wrapper.querySelector('.annotation-legend')
        if (existingLegend) {
            existingLegend.remove()
        }
        // Remove the old bare img if it's still directly in wrapper
        const remainingImg = wrapper.querySelector('img')
        if (remainingImg) remainingImg.remove()

        // Find the caption div (last child div with font-size 11px)
        const caption = wrapper.querySelector('div[style*="font-size"]')

        const markerColors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#ca8a04', '#be185d', '#15803d']

        if (annotations.length > 0) {
            // Create a container that wraps the image + numbered pins
            const imgContainer = document.createElement('div')
            imgContainer.className = 'annotation-overlay'
            imgContainer.setAttribute('contenteditable', 'false')
            imgContainer.style.cssText = 'position:relative;display:inline-block;cursor:pointer;'

            imgContainer.appendChild(cleanImg)

            // Numbered pin markers on the image
            annotations.forEach((ann, index) => {
                const color = markerColors[index % markerColors.length]
                const pin = document.createElement('div')
                pin.style.cssText = `position:absolute;left:${ann.xPct}%;top:${ann.yPct}%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);z-index:2;pointer-events:none;display:flex;align-items:center;justify-content:center;`
                pin.innerHTML = `<span style="color:white;font-size:11px;font-weight:700;line-height:1;">${index + 1}</span>`
                imgContainer.appendChild(pin)
            })

            // Insert the annotated container before caption
            if (caption) {
                wrapper.insertBefore(imgContainer, caption)
            } else {
                wrapper.appendChild(imgContainer)
            }

            // Legend below the image
            const legend = document.createElement('div')
            legend.className = 'annotation-legend'
            legend.setAttribute('contenteditable', 'false')
            legend.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;'
            annotations.forEach((ann, index) => {
                const color = markerColors[index % markerColors.length]
                const item = document.createElement('div')
                item.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;`
                item.innerHTML = `<span style="width:18px;height:18px;border-radius:50%;background:${color};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${index + 1}</span><span style="font-weight:600;color:#334155;">${ann.label}</span>`
                legend.appendChild(item)
            })
            if (caption) {
                wrapper.insertBefore(legend, caption)
            } else {
                wrapper.appendChild(legend)
            }
        } else {
            // No annotations — just put back the clean image
            if (caption) {
                wrapper.insertBefore(cleanImg, caption)
            } else {
                wrapper.appendChild(cleanImg)
            }
        }

        setNoteContent(getEditorContent())
        setAnnotationOverlay(null)
    }, [annotationOverlay, getEditorContent])

    useEffect(() => {
        if (location.state) {
            if (location.state.transcript) {
                setTranscriptData(location.state.transcript);
                setActiveTab('transcript');
            }
            if (location.state.summary) {
                setAiSummary(location.state.summary);
            }
        }
    }, [location.state]);

    // Transform old annotation overlays in the note viewing popup
    useEffect(() => {
        const container = noteViewContentRef.current
        if (!container || !viewingNote) return

        // Prevent native image drag
        const imgs = container.querySelectorAll('img')
        imgs.forEach(img => {
            img.draggable = false
            img.ondragstart = () => false
        })

        const markerColors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#ca8a04', '#be185d', '#15803d']

        // Find annotation wrappers (parent divs with data-annotations)
        const wrappers = container.querySelectorAll('div[data-annotations]')
        wrappers.forEach(wrapper => {
            let annotations = []
            try {
                annotations = JSON.parse(wrapper.getAttribute('data-annotations') || '[]')
            } catch { return }
            if (!annotations.length) return

            const overlay = wrapper.querySelector('.annotation-overlay')
            if (!overlay) return

            // Remove old SVG connector lines
            const svg = overlay.querySelector('svg')
            if (svg) svg.remove()

            // Remove old text labels (divs that are not pins and not img)
            const children = Array.from(overlay.children)
            children.forEach(el => {
                if (el.tagName === 'IMG') return
                // It's a pin or label div - remove all, we'll recreate
                el.remove()
            })

            // Add numbered markers on the image
            annotations.forEach((ann, index) => {
                const color = markerColors[index % markerColors.length]
                const pin = document.createElement('div')
                pin.style.cssText = `position:absolute;left:${ann.xPct}%;top:${ann.yPct}%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);z-index:2;pointer-events:none;display:flex;align-items:center;justify-content:center;`
                pin.innerHTML = `<span style="color:white;font-size:11px;font-weight:700;line-height:1;">${index + 1}</span>`
                overlay.appendChild(pin)
            })

            // Remove any existing legend
            const oldLegend = wrapper.querySelector('.annotation-legend')
            if (oldLegend) oldLegend.remove()

            // Add legend below the image
            const legend = document.createElement('div')
            legend.className = 'annotation-legend'
            legend.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;'
            annotations.forEach((ann, index) => {
                const color = markerColors[index % markerColors.length]
                const item = document.createElement('div')
                item.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;`
                item.innerHTML = `<span style="width:18px;height:18px;border-radius:50%;background:${color};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${index + 1}</span><span style="font-weight:600;color:#334155;">${ann.label}</span>`
                legend.appendChild(item)
            })
            // Insert legend after the overlay
            overlay.parentNode.insertBefore(legend, overlay.nextSibling)
        })
    }, [viewingNote])

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!file.type.startsWith('audio/')) {
            setUploadError('Please select an audio file')
            return
        }
        setUploadFile(file)
        setUploadError('')
        // Automatically start upload after file selection
        handleUploadAudioWithFile(file)
    }

    const handleUploadAudioWithFile = async (file) => {
        if (!selectedPatientId) {
            setUploadError('Please select a patient first')
            return
        }
        if (!file) return

        setUploading(true)
        setUploadError('')
        setUploadProgress(0)
        setUploadStep('uploading')

        let recordingId = null

        try {
            // Step 1: Upload the audio file
            const formData = new FormData()
            formData.append('audio', file)
            formData.append('patient_id', selectedPatientId)

            const response = await recordingService.uploadAudioFile(formData, (progressEvent) => {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                setUploadProgress(percent)
            })

            if (response.data) {
                recordingId = response.data.id
            }

            // Step 2: Transcribe the audio
            setUploadStep('transcribing')
            setUploadProgress(0)
            let transcriptText = ''

            try {
                const transcribeForm = new FormData()
                transcribeForm.append('audio', file)
                const transcribeResponse = await recordingService.transcribeAudio(transcribeForm)
                if (transcribeResponse.data && transcribeResponse.data.success) {
                    transcriptText = transcribeResponse.data.transcript
                } else {
                    throw new Error(transcribeResponse.data?.message || 'Transcription failed')
                }
            } catch (transcribeError) {
                console.error('Error transcribing audio:', transcribeError)
                setUploadError('Audio uploaded, but transcription failed: ' + transcribeError.message)
            }

            // Save transcript to recording
            if (recordingId && transcriptText.length > 0) {
                try {
                    await recordingService.update(recordingId, { transcript: transcriptText })
                } catch (updateErr) {
                    console.error('Error saving transcript:', updateErr)
                }
            }

            // Step 3: Generate clinical summary
            if (transcriptText.length > 0) {
                setUploadStep('summarizing')
                setGeneratingSummary(true)
                try {
                    const summaryResponse = await recordingService.generateClinicalSummary({
                        transcript: transcriptText,
                        patient_id: selectedPatientId,
                        duration: 'N/A'
                    })
                    if (summaryResponse.data && summaryResponse.data.success) {
                        setClinicalSummary(summaryResponse.data.summary)
                        setAiSummary(summaryResponse.data.summary)
                        if (recordingId) {
                            try {
                                await recordingService.update(recordingId, { summary: summaryResponse.data.summary })
                            } catch (updateErr) {
                                console.error('Error saving summary:', updateErr)
                            }
                        }
                        setShowSummaryModal(true)

                        // Auto-save the generated report as a PDF in "Previous Reports" — background upload, no local download
                        try {
                            const patientData = patients.find(p => p.id === parseInt(selectedPatientId))
                            const patientName = patientData?.full_name || 'Patient'
                            exportClinicalSummaryToPDF(
                                summaryResponse.data.summary,
                                patientName,
                                null,
                                {
                                    patientId: selectedPatientId,
                                    sessionId: recordingId,
                                    title: `Clinical Summary — ${new Date().toLocaleDateString()}`,
                                    skipLocalSave: true,
                                }
                            )
                        } catch (autoSaveErr) {
                            console.warn('Auto-save of generated report failed:', autoSaveErr)
                        }
                    }
                } catch (summaryError) {
                    console.error('Error generating summary:', summaryError)
                } finally {
                    setGeneratingSummary(false)
                }
            }

            // Set transcript data to show in the tab
            if (transcriptText.length > 0) {
                setTranscriptData(transcriptText)
            }

            setUploadFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err) {
            console.error('Error uploading audio:', err)
            setUploadError(err.response?.data?.message || 'Failed to upload audio file')
        } finally {
            setUploading(false)
            setUploadProgress(0)
            setUploadStep('')
        }
    }

    const sectionHeader = (title) =>
        `<div style="background:#f8fafc;border-left:3px solid #4338ca;padding:6px 12px;margin:20px 0 12px 0;"><b style="color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${title}</b></div>`

    const fieldRow = (label, placeholder = '') =>
        `<p style="margin:6px 0;line-height:1.8;"><b style="color:#334155;">${label}:</b> <span style="color:#64748b;">${placeholder || '_______________'}</span></p>`

    const tableRow = (label, value = '') =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#334155;width:40%;background:#f8fafc;">${label}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;">${value}</td></tr>`

    const docHeader = (title, subtitle) =>
        `<div style="background:#1e293b;color:white;padding:20px 24px;border-radius:8px 8px 0 0;margin:-4px -4px 0 -4px;">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;">` +
        `<div><div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">DynaCare</div></div>` +
        `<div style="text-align:right;"><div style="font-size:14px;opacity:0.8;">${title}</div></div>` +
        `</div></div>` +
        `<div style="background:#f1f5f9;padding:12px 24px;border:1px solid #e2e8f0;border-top:none;margin:0 -4px 16px -4px;display:flex;gap:40px;">` +
        `<div><div style="font-size:10px;color:#4338ca;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Patient Name</div><div style="font-size:13px;color:#0f172a;margin-top:2px;">_______________</div></div>` +
        `<div><div style="font-size:10px;color:#4338ca;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Date of Service</div><div style="font-size:13px;color:#0f172a;margin-top:2px;">${new Date().toLocaleDateString()}</div></div>` +
        `<div><div style="font-size:10px;color:#4338ca;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Clinician</div><div style="font-size:13px;color:#0f172a;margin-top:2px;">_______________</div></div>` +
        `</div>`

    const docFooter = () =>
        `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;">` +
        `<span style="font-size:10px;color:#94a3b8;">DynaCare</span>` +
        `<span style="font-size:10px;color:#94a3b8;">Clinician Signature: _______________</span>` +
        `</div>`

    const templates = {
        intake: docHeader('Initial Assessment', 'Comprehensive intake evaluation') +
            sectionHeader('Chief Complaint') +
            fieldRow('Presenting Problem') +
            fieldRow('Duration of Symptoms') +
            fieldRow('Precipitating Factors') +
            sectionHeader('History of Present Illness') +
            fieldRow('Onset') +
            fieldRow('Course') +
            fieldRow('Previous Treatment') +
            fieldRow('Current Medications') +
            sectionHeader('Past Psychiatric History') +
            fieldRow('Previous Diagnoses') +
            fieldRow('Hospitalizations') +
            fieldRow('Substance Use History') +
            fieldRow('Family Psychiatric History') +
            sectionHeader('Mental Status Examination') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Appearance', '') +
            tableRow('Behavior', '') +
            tableRow('Speech', '') +
            tableRow('Mood (self-reported)', '') +
            tableRow('Affect (observed)', '') +
            tableRow('Thought Process', '') +
            tableRow('Thought Content', '') +
            tableRow('Perceptions', '') +
            tableRow('Cognition', '') +
            tableRow('Insight / Judgment', '') +
            `</table>` +
            sectionHeader('Risk Assessment') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Suicidal Ideation', 'None / Passive / Active') +
            tableRow('Homicidal Ideation', 'None / Passive / Active') +
            tableRow('Self-Harm', 'None / Historical / Current') +
            tableRow('Overall Risk Level', 'Low / Moderate / High') +
            `</table>` +
            sectionHeader('Diagnostic Impression') +
            fieldRow('Primary Diagnosis (DSM-5)') +
            fieldRow('Secondary Diagnosis') +
            fieldRow('Rule-Out') +
            sectionHeader('Treatment Plan') +
            fieldRow('Treatment Goals') +
            fieldRow('Recommended Interventions') +
            fieldRow('Medication Recommendations') +
            fieldRow('Follow-up Schedule') +
            docFooter(),

        followup: docHeader('Follow-up Session Note', 'SOAP format progress note') +
            sectionHeader('Subjective') +
            fieldRow('Patient Report') +
            fieldRow('Mood (self-reported)') +
            fieldRow('Sleep / Appetite') +
            fieldRow('Medication Compliance') +
            fieldRow('Stressors Since Last Visit') +
            sectionHeader('Objective') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Appearance', '') +
            tableRow('Affect', '') +
            tableRow('Speech', '') +
            tableRow('Thought Process', '') +
            tableRow('Insight / Judgment', '') +
            `</table>` +
            sectionHeader('Assessment') +
            fieldRow('Clinical Impression') +
            fieldRow('Progress Toward Goals') +
            fieldRow('Risk Assessment', 'Low / Moderate / High') +
            sectionHeader('Plan') +
            fieldRow('Interventions Used This Session') +
            fieldRow('Medication Changes') +
            fieldRow('Homework / Assignments') +
            fieldRow('Next Appointment') +
            docFooter(),

        progress: docHeader('Progress Review', 'Treatment progress evaluation') +
            sectionHeader('Treatment Goals Review') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Goal 1', '') +
            tableRow('Status', 'Not Started / In Progress / Achieved') +
            tableRow('Goal 2', '') +
            tableRow('Status', 'Not Started / In Progress / Achieved') +
            tableRow('Goal 3', '') +
            tableRow('Status', 'Not Started / In Progress / Achieved') +
            `</table>` +
            sectionHeader('Interventions & Response') +
            fieldRow('Therapeutic Modalities Used') +
            fieldRow('Patient Response to Treatment') +
            fieldRow('Barriers to Progress') +
            sectionHeader('Symptom Tracking') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Primary Symptoms', '') +
            tableRow('Severity (1-10)', '') +
            tableRow('Change Since Last Review', 'Improved / Stable / Worsened') +
            `</table>` +
            sectionHeader('Recommendations') +
            fieldRow('Treatment Plan Modifications') +
            fieldRow('Referrals') +
            fieldRow('Next Review Date') +
            docFooter(),

        crisis: docHeader('Crisis Intervention', 'Urgent clinical documentation') +
            `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin:0 0 16px 0;">` +
            `<b style="color:#991b1b;font-size:12px;">PRIORITY: CRISIS DOCUMENTATION</b>` +
            `</div>` +
            sectionHeader('Crisis Presentation') +
            fieldRow('Nature of Crisis') +
            fieldRow('Onset / Trigger') +
            fieldRow('Current Symptoms') +
            sectionHeader('Safety Assessment') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Suicidal Ideation', 'None / Passive / Active with Plan') +
            tableRow('Plan', 'N/A or describe') +
            tableRow('Intent', 'N/A / Low / Moderate / High') +
            tableRow('Access to Means', 'None / Limited / Available') +
            tableRow('Protective Factors', '') +
            tableRow('Homicidal Ideation', 'None / Passive / Active') +
            tableRow('Overall Risk Level', 'Low / Moderate / High / Imminent') +
            `</table>` +
            sectionHeader('Interventions') +
            fieldRow('Interventions Provided') +
            fieldRow('De-escalation Techniques Used') +
            fieldRow('Collateral Contacts Made') +
            sectionHeader('Safety Plan') +
            fieldRow('Warning Signs Identified') +
            fieldRow('Coping Strategies') +
            fieldRow('Support Contacts') +
            fieldRow('Emergency Resources Provided') +
            fieldRow('Safety Plan Established', 'Yes / No') +
            sectionHeader('Disposition') +
            fieldRow('Disposition', 'Discharged / Referred / Hospitalized') +
            fieldRow('Follow-up Plan') +
            fieldRow('Follow-up Timeframe') +
            docFooter(),

        termination: docHeader('Termination Summary', 'End of treatment documentation') +
            sectionHeader('Treatment Summary') +
            fieldRow('Total Sessions Attended') +
            fieldRow('Treatment Duration') +
            fieldRow('Primary Diagnosis at Intake') +
            fieldRow('Diagnosis at Discharge') +
            sectionHeader('Goals & Outcomes') +
            `<table style="width:100%;border-collapse:collapse;margin:8px 0;">` +
            tableRow('Goal 1', '') +
            tableRow('Outcome', 'Achieved / Partially / Not Achieved') +
            tableRow('Goal 2', '') +
            tableRow('Outcome', 'Achieved / Partially / Not Achieved') +
            tableRow('Goal 3', '') +
            tableRow('Outcome', 'Achieved / Partially / Not Achieved') +
            `</table>` +
            sectionHeader('Clinical Progress') +
            fieldRow('Symptom Changes') +
            fieldRow('Functional Improvements') +
            fieldRow('Remaining Concerns') +
            sectionHeader('Discharge Plan') +
            fieldRow('Reason for Termination') +
            fieldRow('Maintenance Strategies') +
            fieldRow('Relapse Prevention Plan') +
            fieldRow('Referrals Provided') +
            fieldRow('Recommended Follow-up') +
            docFooter()
    }

    const handleApplyTemplate = (id) => {
        const templateContent = templates[id];
        if (!templateContent) return;

        const editorText = getEditorTextContent()
        if (editorText && editorText.trim().length > 10 && !window.confirm("This will overwrite your current note. Continue?")) {
            return;
        }

        if (editorRef.current) {
            editorRef.current.innerHTML = templateContent
        }
        setNoteContent(templateContent);
        setCharCount(0);
        setSelectedTemplate(id);
        setActiveTab('editor');
        setIsTemplatesOpen(false);
    }

    const fetchSavedNotes = async () => {
        setNotesLoading(true)
        try {
            const response = await noteService.getAll()
            setSavedNotes(response.data || [])
        } catch (err) {
            console.error('Error fetching saved notes:', err)
        } finally {
            setNotesLoading(false)
        }
    }

    const handleSaveNote = async () => {
        const content = noteContent || getEditorContent() || ''

        if (!selectedPatientId) {
            alert("Please select a patient before saving.");
            return;
        }

        setIsSaving(true);
        try {
            const noteData = {
                patient_id: parseInt(selectedPatientId),
                appointment_id: location.state?.appointmentId || null,
                content: content,
                status: 'Finalized',
                ai_insights: aiSummary ? JSON.stringify(aiSummary) : null,
                session_id: currentSessionId || null
            };

            if (editingNoteId) {
                // Update existing note
                await noteService.update(editingNoteId, noteData);
                alert("Note updated successfully!");
            } else {
                // Create new note
                await noteService.create(noteData);
                if (currentSessionId) {
                    alert("Note saved! You can now send assessments for this session.");
                    setActiveTab('assessments');
                } else {
                    alert("Note saved and finalized successfully!");
                }
            }
            fetchSavedNotes();
            // Refresh patient sessions list
            if (selectedPatientId) {
                const notesRes = await noteService.getByPatientId(selectedPatientId)
                setPatientSessions(notesRes.data || [])
            }
            // Refresh sessions from API
            if (selectedPatientId) {
                try {
                    const sessRes = await sessionService.getByPatientId(selectedPatientId)
                    setApiSessions(sessRes.data || [])
                } catch {}
            }
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note: " + (error.response?.data?.message || error.message));
        } finally {
            setIsSaving(false);
        }
    }

    // Fetch assessment responses when patient changes
    useEffect(() => {
        if (!selectedPatientId) {
            setAssessmentResponses([]); setGad7Responses([]); setPcl5Responses([]); setAuditResponses([]); setCageResponses([]); setMdqResponses([])
            return
        }
        const fetchResponses = async () => {
            setAssessmentResponsesLoading(true)
            try {
                const [phq9Res, gad7Res, pcl5Res, auditRes, cageRes, mdqRes] = await Promise.all([
                    assessmentService.getResponses(selectedPatientId, 'PHQ9'),
                    assessmentService.getResponses(selectedPatientId, 'GAD7'),
                    assessmentService.getResponses(selectedPatientId, 'PCL5'),
                    assessmentService.getResponses(selectedPatientId, 'AUDIT'),
                    assessmentService.getResponses(selectedPatientId, 'CAGE'),
                    assessmentService.getResponses(selectedPatientId, 'MDQ'),
                ])
                setAssessmentResponses(phq9Res.data || [])
                setGad7Responses(gad7Res.data || [])
                setPcl5Responses(pcl5Res.data || [])
                setAuditResponses(auditRes.data || [])
                setCageResponses(cageRes.data || [])
                setMdqResponses(mdqRes.data || [])
            } catch (err) {
                console.error('Error fetching assessment responses:', err)
            } finally {
                setAssessmentResponsesLoading(false)
            }
        }
        fetchResponses()
    }, [selectedPatientId])

    const handleGenerateAssessmentLink = async (assessmentType, openInTab = false) => {
        if (!selectedPatientId) {
            alert('Please select a patient first.')
            return
        }
        setAssessmentLinkLoading(true)
        setAssessmentLink('')
        setLinkCopied(false)
        setAssessmentMenuOpen(null)
        try {
            const res = await assessmentService.createToken({ patient_id: parseInt(selectedPatientId), assessment_type: assessmentType, session_id: currentSessionId || null })
            const baseUrl = window.location.origin
            const link = `${baseUrl}/assessment/${assessmentType.toLowerCase()}/${res.data.token}`
            if (openInTab) {
                window.open(link, '_blank')
            } else {
                setAssessmentLink(link)
                navigator.clipboard.writeText(link).then(() => {
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                })
            }
        } catch (err) {
            console.error('Error generating assessment link:', err)
            alert('Failed to generate link.')
        } finally {
            setAssessmentLinkLoading(false)
        }
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(assessmentLink)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
    }

    const getPhq9Interpretation = (score) => {
        if (score <= 4) return { label: 'Minimal', color: 'text-green-700', bg: 'bg-green-100' }
        if (score <= 9) return { label: 'Mild', color: 'text-yellow-700', bg: 'bg-yellow-100' }
        if (score <= 14) return { label: 'Moderate', color: 'text-orange-700', bg: 'bg-orange-100' }
        if (score <= 19) return { label: 'Moderately Severe', color: 'text-red-600', bg: 'bg-red-100' }
        return { label: 'Severe', color: 'text-red-800', bg: 'bg-red-200' }
    }

    const getGad7Interpretation = (score) => {
        if (score <= 4) return { label: 'Minimal', color: 'text-green-700', bg: 'bg-green-100' }
        if (score <= 9) return { label: 'Mild', color: 'text-yellow-700', bg: 'bg-yellow-100' }
        if (score <= 14) return { label: 'Moderate', color: 'text-orange-700', bg: 'bg-orange-100' }
        return { label: 'Severe', color: 'text-red-800', bg: 'bg-red-200' }
    }

    const getPcl5Interpretation = (score) => {
        if (score <= 10) return { label: 'Minimal', color: 'text-green-700', bg: 'bg-green-100' }
        if (score <= 25) return { label: 'Mild', color: 'text-yellow-700', bg: 'bg-yellow-100' }
        if (score <= 40) return { label: 'Moderate', color: 'text-orange-700', bg: 'bg-orange-100' }
        return { label: 'Severe', color: 'text-red-800', bg: 'bg-red-200' }
    }

    const getAuditInterpretation = (score) => {
        if (score <= 3) return { label: 'Low Risk', color: 'text-green-700', bg: 'bg-green-100' }
        if (score <= 9) return { label: 'Risky', color: 'text-yellow-700', bg: 'bg-yellow-100' }
        if (score <= 13) return { label: 'Harmful', color: 'text-orange-700', bg: 'bg-orange-100' }
        return { label: 'Dependence', color: 'text-red-800', bg: 'bg-red-200' }
    }

    const getCageInterpretation = (score) => {
        if (score === 0) return { label: 'Negative', color: 'text-green-700', bg: 'bg-green-100' }
        if (score === 1) return { label: 'Possible', color: 'text-yellow-700', bg: 'bg-yellow-100' }
        return { label: 'Positive', color: 'text-red-700', bg: 'bg-red-100' }
    }

    const getMdqInterpretation = (score) => {
        if (score < 7) return { label: 'Negative', color: 'text-green-700', bg: 'bg-green-100' }
        return { label: 'Positive Screen', color: 'text-red-700', bg: 'bg-red-100' }
    }

    // Build session history: group notes, recordings, and assessments by date+patient
    const buildSessionHistory = () => {
        const sessions = []
        const usedNoteIds = new Set()
        const usedRecordingIds = new Set()
        const usedAssessmentIds = new Set()

        const allAssessments = [
            ...assessmentResponses.map(r => ({ ...r, _type: 'PHQ9' })),
            ...gad7Responses.map(r => ({ ...r, _type: 'GAD7' })),
            ...pcl5Responses.map(r => ({ ...r, _type: 'PCL5' })),
            ...auditResponses.map(r => ({ ...r, _type: 'AUDIT' })),
            ...cageResponses.map(r => ({ ...r, _type: 'CAGE' })),
            ...mdqResponses.map(r => ({ ...r, _type: 'MDQ' })),
        ]

        // Group 1: Sessions from API (connected flow, session_id linked)
        apiSessions.forEach(s => {
            let aiInsights = null
            const raw = s.note?.ai_insights || s.recording?.summary
            if (raw) {
                try { aiInsights = typeof raw === 'string' ? JSON.parse(raw) : raw } catch {}
            }
            // Mark items as used so they don't appear again in legacy grouping
            if (s.note) usedNoteIds.add(s.note.id)
            if (s.recording) usedRecordingIds.add(s.recording.id)
            const sessionAssessments = (s.assessments || []).map(a => {
                usedAssessmentIds.add(a.id)
                return { ...a, _type: a.assessment_type }
            })

            sessions.push({
                id: `session-${s.id}`,
                date: new Date(s.created_at),
                patientName: s.patient_name || 'Unknown Patient',
                patientId: s.patient_id,
                note: s.note || null,
                recording: s.recording || null,
                aiInsights,
                assessments: sessionAssessments,
                sessionStatus: s.status,
            })
        })

        // Group 2: Legacy notes without session_id (fallback heuristic)
        savedNotes.forEach(note => {
            if (usedNoteIds.has(note.id)) return
            const noteTime = new Date(note.created_at).getTime()
            const noteDate = new Date(note.created_at).toISOString().split('T')[0]

            const matchingRec = patientRecordingsMap.find(r => {
                if (usedRecordingIds.has(r.id)) return false
                if (note.patient_id && String(r.patient_id) !== String(note.patient_id)) return false
                return Math.abs(new Date(r.created_at).getTime() - noteTime) < 30 * 60 * 1000
            })
            if (matchingRec) usedRecordingIds.add(matchingRec.id)

            let aiInsights = null
            const raw = note.ai_insights || matchingRec?.summary
            if (raw) {
                try { aiInsights = typeof raw === 'string' ? JSON.parse(raw) : raw } catch {}
            }

            const dayAssessments = allAssessments.filter(a => {
                if (usedAssessmentIds.has(a.id)) return false
                if (note.patient_id && String(a.patient_id) !== String(note.patient_id)) return false
                return new Date(a.created_at).toISOString().split('T')[0] === noteDate
            })

            sessions.push({
                id: `note-${note.id}`,
                date: new Date(note.created_at),
                patientName: note.patient_name || 'Unknown Patient',
                patientId: note.patient_id,
                note,
                recording: matchingRec || null,
                aiInsights,
                assessments: dayAssessments,
            })
        })

        // Group 3: Orphan recordings (no note, no session_id)
        patientRecordingsMap.forEach(rec => {
            if (usedRecordingIds.has(rec.id)) return
            let aiInsights = null
            if (rec.summary) {
                try { aiInsights = typeof rec.summary === 'string' ? JSON.parse(rec.summary) : rec.summary } catch {}
            }
            sessions.push({
                id: `rec-${rec.id}`,
                date: new Date(rec.created_at),
                patientName: patients.find(p => String(p.id) === String(rec.patient_id))?.full_name || 'Unknown Patient',
                patientId: rec.patient_id,
                note: null,
                recording: rec,
                aiInsights,
                assessments: [],
            })
        })

        sessions.sort((a, b) => b.date - a.date)
        return sessions
    }

    const CHART_LINES = [
        { key: 'PHQ9', name: 'PHQ-9', color: '#3b82f6', max: 27, responses: assessmentResponses },
        { key: 'GAD7', name: 'GAD-7', color: '#8b5cf6', max: 21, responses: gad7Responses },
        { key: 'PCL5', name: 'PCL-5', color: '#ef4444', max: 80, responses: pcl5Responses },
        { key: 'AUDIT', name: 'AUDIT', color: '#f97316', max: 40, responses: auditResponses },
        { key: 'CAGE', name: 'CAGE', color: '#eab308', max: 4, responses: cageResponses },
        { key: 'MDQ', name: 'MDQ', color: '#14b8a6', max: 13, responses: mdqResponses },
    ]

    // Build chart data: each row = one attempt index, columns = score per type at that attempt
    const buildChartData = () => {
        const visibleKeys = chartFilter === 'all' ? CHART_LINES.map(l => l.key) : [chartFilter]
        const visibleLines = CHART_LINES.filter(l => visibleKeys.includes(l.key))

        // For each visible type, sort responses oldest-first and number them as attempts
        const seriesMap = {}
        let maxAttempts = 0
        visibleLines.forEach(line => {
            const sorted = [...line.responses].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            seriesMap[line.key] = sorted
            if (sorted.length > maxAttempts) maxAttempts = sorted.length
        })

        if (maxAttempts === 0) return []

        const data = []
        for (let i = 0; i < maxAttempts; i++) {
            const row = { attempt: i + 1 }
            // For date mode, collect dates from this attempt index
            const dates = []
            visibleLines.forEach(line => {
                const resp = seriesMap[line.key]?.[i]
                if (resp) {
                    row[line.key] = resp.total_score
                    dates.push(new Date(resp.created_at))
                }
            })
            // Use the earliest date among types at this attempt index
            if (dates.length > 0) {
                const d = dates.sort((a, b) => a - b)[0]
                row.dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
            }
            data.push(row)
        }
        return data
    }

    // Build HTML for AI report section
    const buildReportHtml = (insights) => {
        if (!insights) return ''
        let html = '<div class="report"><h2>AI Clinical Report</h2>'

        // Overview
        if (insights.overview) {
            const o = insights.overview
            html += '<h3>Session Overview</h3><table>'
            if (o.mood) html += `<tr><td><strong>Mood</strong></td><td>${o.mood}</td></tr>`
            if (o.moodScore) html += `<tr><td><strong>Mood Score</strong></td><td>${o.moodScore}/10</td></tr>`
            if (o.affect) html += `<tr><td><strong>Affect</strong></td><td>${o.affect}</td></tr>`
            if (o.engagement) html += `<tr><td><strong>Engagement</strong></td><td>${o.engagement}</td></tr>`
            if (o.primaryConcerns) html += `<tr><td><strong>Primary Concerns</strong></td><td>${Array.isArray(o.primaryConcerns) ? o.primaryConcerns.join(', ') : o.primaryConcerns}</td></tr>`
            html += '</table>'
        }

        // Symptoms
        if (insights.symptoms?.reported?.length > 0) {
            html += '<h3>Reported Symptoms</h3><ul>'
            insights.symptoms.reported.forEach(s => { html += `<li>${s}</li>` })
            html += '</ul>'
            if (insights.symptoms.severity) html += `<p><strong>Severity:</strong> ${insights.symptoms.severity}</p>`
        }

        // Risk Assessment
        if (insights.riskAssessment) {
            const r = insights.riskAssessment
            const color = r.level === 'High' ? '#dc2626' : r.level === 'Moderate' ? '#ca8a04' : '#16a34a'
            html += `<h3>Risk Assessment</h3><p style="color:${color};font-weight:bold;">Level: ${r.level}</p>`
            if (r.concerns?.length > 0) {
                html += '<ul>'
                r.concerns.forEach(c => { html += `<li>${c}</li>` })
                html += '</ul>'
            }
        }

        // DSM-5 Indications
        if (insights.clinicalImpression?.possibleDiagnoses?.length > 0) {
            html += '<h3>DSM-5 Indications</h3><table><tr><th>Code</th><th>Diagnosis</th><th>Confidence</th></tr>'
            insights.clinicalImpression.possibleDiagnoses.forEach(d => {
                html += `<tr><td>${d.code || 'N/A'}</td><td>${d.name}</td><td>${d.confidence || 'N/A'}</td></tr>`
            })
            html += '</table>'
        }

        // Key Themes
        if (insights.clinicalInsights?.themes?.length > 0) {
            html += '<h3>Key Themes</h3><ul>'
            insights.clinicalInsights.themes.forEach(t => { html += `<li>${t}</li>` })
            html += '</ul>'
        }

        // Treatment Recommendations
        if (insights.treatmentPlan?.recommendations?.length > 0) {
            html += '<h3>Treatment Recommendations</h3><ol>'
            insights.treatmentPlan.recommendations.forEach(r => { html += `<li>${r}</li>` })
            html += '</ol>'
            if (insights.treatmentPlan.followUp) html += `<p><strong>Follow-up:</strong> ${insights.treatmentPlan.followUp}</p>`
        }

        // Next Steps
        if (insights.nextSteps?.length > 0) {
            html += '<h3>Next Steps</h3><ul>'
            insights.nextSteps.forEach(s => { html += `<li>${s}</li>` })
            html += '</ul>'
        }

        html += '</div>'
        return html
    }

    const handleDownloadExport = () => {
        let content, noteDate, noteStatus, patientName, noteInsights

        if (exportSelectedNoteId === 'current') {
            // Export current editor content
            content = noteContent || getEditorContent()
            noteDate = new Date()
            noteStatus = editingNoteId ? 'Finalized' : 'Draft'
            patientName = patients.find(p => String(p.id) === String(selectedPatientId))?.full_name || 'Unknown'
            noteInsights = aiSummary
        } else {
            // Export a specific saved note
            const allNotes = [...savedNotes, ...patientSessions]
            const note = allNotes.find(n => String(n.id) === String(exportSelectedNoteId))
            if (!note) {
                alert('Selected note not found.')
                return
            }
            content = note.content
            noteDate = new Date(note.created_at)
            noteStatus = note.status || 'Finalized'
            patientName = note.patient_name || patients.find(p => String(p.id) === String(note.patient_id))?.full_name || 'Unknown'
            // Parse AI insights from the note
            if (note.ai_insights) {
                try {
                    noteInsights = typeof note.ai_insights === 'string' ? JSON.parse(note.ai_insights) : note.ai_insights
                } catch { noteInsights = null }
            }
        }

        const textContent = content?.replace(/<[^>]*>/g, '') || ''
        if (!textContent.trim()) {
            alert('The selected note has no content to export.')
            return
        }

        const dateStr = noteDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
        const timeStr = noteDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

        const reportHtml = (exportIncludeReport && noteInsights) ? buildReportHtml(noteInsights) : ''

        if (exportFormat === 'PDF') {
            const printWindow = window.open('', '_blank')
            printWindow.document.write(`
                <html>
                <head>
                    <title>Session Notes - ${patientName}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.7; }
                        h1 { font-size: 22px; margin-bottom: 4px; }
                        h2 { font-size: 18px; margin-top: 32px; padding-bottom: 8px; border-bottom: 2px solid #4f46e5; color: #4f46e5; }
                        h3 { font-size: 14px; margin-top: 18px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
                        .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
                        .content { font-size: 15px; }
                        .content h1, .content h2, .content h3 { margin-top: 20px; }
                        .content ul, .content ol { padding-left: 20px; }
                        .content img { max-width: 100%; }
                        .report { margin-top: 32px; padding-top: 24px; border-top: 3px solid #e2e8f0; }
                        .report table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                        .report th, .report td { text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; }
                        .report th { background: #f1f5f9; font-weight: 600; color: #334155; }
                        .report ul, .report ol { padding-left: 20px; margin: 8px 0; }
                        .report li { margin-bottom: 4px; font-size: 13px; }
                        @media print { body { padding: 20px; } }
                    </style>
                </head>
                <body>
                    <h1>Session Notes</h1>
                    <div class="meta">
                        <strong>Patient:</strong> ${patientName} &nbsp;&bull;&nbsp;
                        <strong>Date:</strong> ${dateStr} at ${timeStr} &nbsp;&bull;&nbsp;
                        <strong>Status:</strong> ${noteStatus}
                    </div>
                    <div class="content">${content}</div>
                    ${reportHtml}
                </body>
                </html>
            `)
            printWindow.document.close()
            printWindow.print()
        } else if (exportFormat === 'Word') {
            const html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="utf-8"><title>Session Notes</title>
                <style>
                    table { width: 100%; border-collapse: collapse; }
                    th, td { text-align: left; padding: 6px 10px; border: 1px solid #ccc; }
                    th { background: #f0f0f0; }
                </style>
                </head>
                <body>
                    <h1>Session Notes</h1>
                    <p><strong>Patient:</strong> ${patientName} | <strong>Date:</strong> ${dateStr} at ${timeStr} | <strong>Status:</strong> ${noteStatus}</p>
                    <hr>
                    ${content}
                    ${reportHtml}
                </body>
                </html>
            `
            const blob = new Blob([html], { type: 'application/msword' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Session_Notes_${patientName.replace(/\s+/g, '_')}_${dateStr.replace(/\s+/g, '_')}.doc`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    const handleGetSymptomReport = async () => {
        const sourceData = getEditorTextContent() || transcriptData;

        if (!sourceData || sourceData.trim().length < 10) {
            alert("Please paste the session transcript or notes into the editor first to analyze symptoms.");
            return;
        }

        setIsSymptomReportLoading(true);
        try {
            const response = await aiService.getSymptomReport(sourceData);
            setSymptomReport(response.data);
            setActiveTab('ai-insights');
        } catch (error) {
            console.error("Error getting symptom report:", error);
            alert("Failed to generate symptom report. Please try again.");
        } finally {
            setIsSymptomReportLoading(false);
        }
    }

    const tabIcons = {
        editor: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
        'ai-insights': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
        ),
        transcript: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        assessments: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        history: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        export: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    }

    const tabs = [
        { id: 'editor', label: 'Editor' },
        { id: 'ai-insights', label: 'AI Insights' },
        { id: 'transcript', label: 'Transcript' },
        { id: 'assessments', label: 'Assessments' },
        { id: 'history', label: 'History' },
        { id: 'export', label: 'Export' }
    ]

    const templateIcons = {
        intake: (
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
        followup: (
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        ),
        progress: (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
        crisis: (
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        termination: (
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    }

    const templateOptions = [
        { id: 'intake', name: 'Initial Assessment' },
        { id: 'followup', name: 'Follow-up Session' },
        { id: 'progress', name: 'Progress Review' },
        { id: 'crisis', name: 'Crisis Intervention' },
        { id: 'termination', name: 'Termination Session' }
    ]

    const sessionInfo = {
        date: new Date().toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        }),
        duration: location.state?.duration || '45 min',
        type: 'Follow-up',
        status: 'In Progress'
    }

    const quickActionIcons = {
        'Save Draft': (
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
        ),
        'Export Report': (
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        'Schedule Follow-up': (
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    }

    const quickActions = [
        { label: 'Save Draft', onClick: handleSaveNote },
        { label: 'Export Report', onClick: handleDownloadExport },
        { label: 'Schedule Follow-up', onClick: () => navigate('/appointments') }
    ]

    return (
        <div className={`flex-1 overflow-y-auto bg-slate-50 ${isFullScreen ? 'fixed inset-0 z-[100] h-screen w-screen' : ''}`}>
            {/* Header */}
            {!isFullScreen && (
                <header className="bg-white border-b border-slate-200 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 font-display">Session Notes</h1>
                            <p className="text-slate-500 mt-1">Create comprehensive clinical documentation with AI-assisted analysis</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium text-slate-600">Patient:</label>
                                <select
                                    value={selectedPatientId}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[180px]"
                                >
                                    <option value="">Select patient</option>
                                    {patients.length > 0 ? patients.map(p => (
                                        <option key={p.id} value={String(p.id)}>{p.full_name}</option>
                                    )) : <option disabled>Loading...</option>}
                                </select>
                            </div>
                            {selectedPatientId && patientSessions.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm font-medium text-slate-600">Session:</label>
                                    <select
                                        value={selectedSessionId}
                                        onChange={(e) => setSelectedSessionId(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[200px]"
                                    >
                                        <option value="">Load past session...</option>
                                        {patientSessions.map(note => {
                                            const d = new Date(note.created_at)
                                            const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                            return (
                                                <option key={note.id} value={String(note.id)}>
                                                    {label} — {note.status}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                            )}
                            {editingNoteId && (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">
                                    Editing Note #{editingNoteId}
                                </span>
                            )}
                            <button
                                onClick={handleNewNote}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center space-x-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>New Note</span>
                            </button>
                            <button onClick={() => navigate('/appointments')} className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2 text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Schedule Follow-up</span>
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Content */}
            <div className={`${isFullScreen ? 'h-full p-4' : 'px-8 py-6'}`}>
                <div className={`grid grid-cols-1 ${isFullScreen ? '' : 'lg:grid-cols-4'} gap-6 h-full`}>
                    {/* Main Editor Area - Left (3/4) */}
                    <div className={`${isFullScreen ? '' : 'lg:col-span-3'} space-y-6 flex flex-col h-full`}>
                        {/* Tabs */}
                        {!isFullScreen && (
                            <div className="bg-white rounded-xl border border-slate-200">
                                <div className="border-b border-slate-200 p-2 flex items-center justify-between">
                                    <div className="flex space-x-1">
                                        {tabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTab === tab.id
                                                    ? 'bg-primary-600 text-white'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {tabIcons[tab.id]}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleSaveNote}
                                        disabled={isSaving}
                                        className={`btn-primary text-sm flex items-center space-x-2 mr-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
                                        <span>{isSaving ? 'Saving...' : editingNoteId ? 'Update' : 'Save'}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Editor Content Area */}
                        <div className={`bg-white rounded-xl border border-slate-200 flex-1 flex flex-col ${isFullScreen ? 'shadow-2xl' : ''}`}>
                            {activeTab === 'editor' && (
                                <div className="p-6 flex flex-col h-full">
                                    {/* Toolbar */}
                                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
                                            <div className="flex items-center space-x-3">
                                                <button
                                                    onClick={() => setIsFullScreen(!isFullScreen)}
                                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1 hover:bg-primary-50 rounded-lg transition-colors"
                                                >
                                                    {isFullScreen ? 'Exit Full-screen' : 'Full-screen'}
                                                </button>
                                                <div className="relative group">
                                                    <button
                                                        onClick={() => setIsTemplatesOpen(!isTemplatesOpen)}
                                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1 px-3 py-1 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <span>Templates</span>
                                                        <svg className={`w-3 h-3 ml-1 transition-transform ${isTemplatesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                    </button>
                                                    <div className={`absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl transition-all z-20 overflow-hidden ${isTemplatesOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'}`}>
                                                        {templateOptions.map(t => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => {
                                                                    handleApplyTemplate(t.id);
                                                                }}
                                                                className="w-full text-left p-3 hover:bg-slate-50 flex items-center space-x-3 text-sm text-slate-700 border-b border-slate-100 last:border-0"
                                                            >
                                                                <span>{t.icon}</span>
                                                                <span>{t.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setShowClearConfirm(true)}
                                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-all flex items-center space-x-2 text-sm"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    <span>Clear All</span>
                                                </button>
                                                <button
                                                    onClick={handleGetSymptomReport}
                                                    disabled={isSymptomReportLoading || (!getEditorTextContent() && !transcriptData)}
                                                    className={`px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-indigo-200 ${(isSymptomReportLoading || (!getEditorTextContent() && !transcriptData)) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSymptomReportLoading ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                                                    <span>{isSymptomReportLoading ? 'Analyzing...' : 'Symptoms Report'}</span>
                                                </button>
                                                <button
                                                    onClick={handleSaveNote}
                                                    disabled={isSaving}
                                                    className={`btn-primary text-sm flex items-center space-x-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSaving ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
                                                    <span>{isSaving ? 'Saving...' : editingNoteId ? 'Update' : 'Save'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Formatting Toolbar */}
                                        <div className="flex items-center space-x-4 pb-4 border-b border-slate-200">
                                            <div className="flex items-center space-x-1 border-r border-slate-200 pr-4">
                                                <button
                                                    onClick={() => handleFormat('bold')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Bold"
                                                >
                                                    <span className="font-bold text-slate-700">B</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFormat('italic')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Italic"
                                                >
                                                    <span className="italic text-slate-700">I</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFormat('underline')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Underline"
                                                >
                                                    <span className="underline text-slate-700">U</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-1 border-r border-slate-200 pr-4">
                                                <button
                                                    onClick={() => handleFormat('list')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Bullet List"
                                                >
                                                    <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {/* Insert Image Button */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => { saveSelection(); setIsImagePickerOpen(!isImagePickerOpen) }}
                                                    className={`p-2 rounded transition-colors flex items-center space-x-1 ${isImagePickerOpen ? 'bg-primary-100 text-primary-700' : 'hover:bg-slate-200 text-slate-700'}`}
                                                    title="Insert Image from Library"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-xs font-medium">Image</span>
                                                </button>
                                                {/* Image Picker Dropdown */}
                                                {isImagePickerOpen && (
                                                    <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                                                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                                                            <h4 className="font-semibold text-slate-800 text-sm">Insert Image</h4>
                                                            <button onClick={() => setIsImagePickerOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto p-2">
                                                            {libraryImages.length > 0 ? (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {libraryImages.map((img) => (
                                                                        <button
                                                                            key={img.id}
                                                                            onClick={() => handleInsertImage(img)}
                                                                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all"
                                                                        >
                                                                            <img
                                                                                src={getImageUrl(img.image_url)}
                                                                                alt={img.label || img.original_name}
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                                                                <p className="text-[9px] text-white truncate">{img.label || img.original_name}</p>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-6">
                                                                    <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <p className="text-xs text-slate-500">No images yet</p>
                                                                    <p className="text-[10px] text-slate-400 mt-1">Upload images in Settings &rarr; Image Library</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rich Text Editor (contentEditable) */}
                                    <div className="mb-6 flex-1 flex flex-col min-h-0">
                                        <div
                                            ref={editorRef}
                                            contentEditable
                                            suppressContentEditableWarning
                                            onInput={handleEditorInput}
                                            onPaste={handleEditorPaste}
                                            data-placeholder="Begin typing your clinical notes here... Use the toolbar above for formatting, select a template, or insert images from your library."
                                            className="w-full flex-1 p-4 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none overflow-y-auto text-slate-700 leading-relaxed min-h-[300px] empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
                                            style={{ wordBreak: 'break-word' }}
                                        />

                                        <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
                                            <span>{charCount} characters</span>
                                            <span>Auto-saved 2 minutes ago</span>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* AI Insights Tab */}
                            {activeTab === 'ai-insights' && (
                                <div className="p-6">
                                    {aiSummary ? (
                                        <div className="space-y-6">
                                            <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                    <span>AI-Generated Clinical Summary</span>
                                                </h3>
                                                <div className="space-y-4">
                                                    <p className="text-slate-700 leading-relaxed">
                                                        <strong>Mood & Affect:</strong> {aiSummary.overview.mood} / {aiSummary.overview.affect}
                                                    </p>
                                                    <p className="text-slate-700 leading-relaxed">
                                                        <strong>Engagement:</strong> {aiSummary.overview.engagement}
                                                    </p>
                                                    <div className="bg-white/50 p-4 rounded-lg border border-blue-100">
                                                        <h4 className="font-bold text-slate-800 mb-2">Key Themes:</h4>
                                                        <p className="text-slate-700">{aiSummary.clinicalInsights?.themes?.join(', ') || 'General therapy session'}</p>
                                                    </div>

                                                    {/* DSM-5 Diagnoses from Summary */}
                                                    {aiSummary.clinicalImpression?.possibleDiagnoses?.length > 0 && (
                                                        <div className="bg-white/50 p-4 rounded-lg border border-blue-100">
                                                            <h4 className="font-bold text-slate-800 mb-2">Preliminary DSM-5 Indications:</h4>
                                                            <ul className="space-y-2">
                                                                {aiSummary.clinicalImpression.possibleDiagnoses.map((dx, i) => (
                                                                    <li key={i} className="text-sm text-slate-700 border-l-2 border-indigo-400 pl-3">
                                                                        <span className="font-bold">{dx.name} ({dx.code})</span>
                                                                        <span className="block text-xs mt-0.5 opacity-80">{dx.criteria_met}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-3 mt-6">
                                                    <button
                                                        onClick={() => {
                                                            if (editorRef.current) {
                                                                editorRef.current.innerHTML += `<hr><p><b>AI Summary</b></p><p><b>Mood:</b> ${aiSummary.overview.mood}</p><p><b>Affect:</b> ${aiSummary.overview.affect}</p><p><b>Themes:</b> ${aiSummary.clinicalInsights?.themes?.join(', ') || 'N/A'}</p>`
                                                                setNoteContent(getEditorContent())
                                                            }
                                                        }}
                                                        className="text-sm font-bold text-primary-600 hover:text-primary-700 px-4 py-2 bg-white rounded-lg border border-primary-200"
                                                    >
                                                        Copy to Notes
                                                    </button>
                                                </div>
                                            </div>

                                            {symptomReport && (
                                                <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                        <span>AI-Detected Symptoms Report</span>
                                                    </h3>
                                                    <div className="mb-4 p-4 bg-white/60 rounded-lg border border-indigo-100 italic text-slate-700">
                                                        {symptomReport.overall_impression}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {symptomReport.symptoms.map((s, idx) => (
                                                            <div key={idx} className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <h4 className="font-bold text-slate-800">{s.symptom}</h4>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${s.severity === 'Severe' ? 'bg-red-100 text-red-600' : s.severity === 'Moderate' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                                        {s.severity}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 mb-2 italic">"{s.evidence}"</p>
                                                                <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-slate-50">
                                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                                        {s.dsm5_mapping}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {symptomReport.risk_factors && symptomReport.risk_factors.length > 0 && (
                                                        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                                                            <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center space-x-2">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                <span>Identified Risk Factors</span>
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {symptomReport.risk_factors.map((risk, i) => (
                                                                    <span key={i} className="px-3 py-1 bg-white text-red-600 text-xs font-semibold rounded-full border border-red-200">
                                                                        {risk}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* <button
                                                        onClick={() => {
                                                            if (editorRef.current) {
                                                                editorRef.current.innerHTML += `<hr><p><b>Symptom Report</b></p><p><b>Impression:</b> ${symptomReport.overall_impression}</p><p><b>Symptoms Found:</b> ${symptomReport.symptoms.map(s => `${s.symptom} (${s.severity})`).join(', ')}</p>`
                                                                setNoteContent(getEditorContent())
                                                            }
                                                        }}
                                                        className="mt-6 w-full py-3 bg-white border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center space-x-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <span>Append Report to Notes</span>
                                                    </button> */}
                                                </div>
                                            )}

                                            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <span>💡</span>
                                                    <span>Suggested Follow-up Items</span>
                                                </h3>
                                                <ul className="space-y-3">
                                                    {aiSummary.nextSteps?.map((step, index) => (
                                                        <li key={index} className="flex items-start space-x-2 text-sm text-slate-700">
                                                            <span className="text-green-500 mt-1">✓</span>
                                                            <span>{step}</span>
                                                        </li>
                                                    ))}
                                                    <li className="flex items-start space-x-2 text-sm text-slate-700">
                                                        <span className="text-green-500 mt-1">✓</span>
                                                        <span>Follow-up: {aiSummary.treatmentPlan?.followUp || 'As scheduled'}</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <span>🎯</span>
                                                    <span>Treatment Goals</span>
                                                </h3>
                                                <div className="space-y-4">
                                                    {aiSummary.treatmentPlan?.goals?.map((goal, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                                                            <span className="text-sm font-medium text-slate-700">{goal}</span>
                                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">New</span>
                                                        </div>
                                                    )) || aiSummary.treatmentPlan?.recommendations?.map((goal, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                                                            <span className="text-sm font-medium text-slate-700">{goal}</span>
                                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Rec</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <span className="text-4xl text-slate-400">🤖</span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No AI Insights Available</h3>
                                            <p className="text-slate-500">Insights are generated automatically after a session recording is completed.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Transcript Tab */}
                            {activeTab === 'transcript' && (
                                <div className="p-6">
                                    {transcriptData ? (
                                        <div className="space-y-6">
                                            <div className="mb-4">
                                                <h3 className="font-bold text-slate-800">Session Transcript</h3>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-h-[600px] overflow-y-auto">
                                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-lg">
                                                    {transcriptData}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="audio/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                            </div>
                                            {uploading ? (
                                                <>
                                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                                        {uploadStep === 'uploading' && 'Uploading audio...'}
                                                        {uploadStep === 'transcribing' && 'Transcribing with AI...'}
                                                        {uploadStep === 'summarizing' && 'Generating clinical summary...'}
                                                    </h3>
                                                    <div className="w-64 mx-auto mt-4">
                                                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                            <span className={uploadStep === 'uploading' ? 'text-primary-600' : 'text-green-600'}>Upload</span>
                                                            <span className={uploadStep === 'transcribing' ? 'text-primary-600' : uploadStep === 'summarizing' ? 'text-green-600' : 'text-slate-400'}>Transcribe</span>
                                                            <span className={uploadStep === 'summarizing' ? 'text-primary-600' : 'text-slate-400'}>Summary</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary-600 rounded-full transition-all duration-500 ease-out"
                                                                style={{ width: uploadStep === 'uploading' ? `${uploadProgress}%` : uploadStep === 'transcribing' ? '66%' : '90%' }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Transcript Available</h3>
                                                    <p className="text-slate-500 mb-6">Upload a session recording to generate an AI transcript</p>
                                                    {uploadError && (
                                                        <p className="text-sm text-red-600 mb-4">{uploadError}</p>
                                                    )}
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="btn-primary"
                                                    >
                                                        Upload Recording
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other tabs placeholder */}
                            {activeTab === 'assessments' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* PHQ-9 Latest Score Card */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">📊</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-blue-200 text-blue-700 rounded-full">
                                                        {assessmentResponses.length > 0 ? 'Latest' : 'N/A'}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">PHQ-9 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-blue-600">
                                                        {assessmentResponses.length > 0 ? assessmentResponses[0].total_score : '--'}
                                                    </span>
                                                    <span className="text-sm text-slate-600">/ 27</span>
                                                </div>
                                                {assessmentResponses.length > 0 ? (
                                                    <>
                                                        <p className={`text-sm font-semibold mt-2 ${getPhq9Interpretation(assessmentResponses[0].total_score).color}`}>
                                                            {getPhq9Interpretation(assessmentResponses[0].total_score).label}
                                                        </p>
                                                        <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                                                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(assessmentResponses[0].total_score / 27) * 100}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            {new Date(assessmentResponses[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-slate-500 mt-2">No data recorded</p>
                                                        <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                                                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-purple-200 text-purple-700 rounded-full">
                                                        {gad7Responses.length > 0 ? 'Latest' : 'N/A'}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">GAD-7 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-purple-600">
                                                        {gad7Responses.length > 0 ? gad7Responses[0].total_score : '--'}
                                                    </span>
                                                    <span className="text-sm text-slate-600">/ 21</span>
                                                </div>
                                                {gad7Responses.length > 0 ? (
                                                    <>
                                                        <p className={`text-sm font-semibold mt-2 ${getGad7Interpretation(gad7Responses[0].total_score).color}`}>
                                                            {getGad7Interpretation(gad7Responses[0].total_score).label}
                                                        </p>
                                                        <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                                                            <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${(gad7Responses[0].total_score / 21) * 100}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            {new Date(gad7Responses[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-slate-500 mt-2">No data recorded</p>
                                                        <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                                                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-red-200 text-red-700 rounded-full">
                                                        {pcl5Responses.length > 0 ? 'Latest' : 'N/A'}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">PCL-5 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-red-600">
                                                        {pcl5Responses.length > 0 ? pcl5Responses[0].total_score : '--'}
                                                    </span>
                                                    <span className="text-sm text-slate-600">/ 80</span>
                                                </div>
                                                {pcl5Responses.length > 0 ? (
                                                    <>
                                                        <p className={`text-sm font-semibold mt-2 ${getPcl5Interpretation(pcl5Responses[0].total_score).color}`}>
                                                            {getPcl5Interpretation(pcl5Responses[0].total_score).label}
                                                        </p>
                                                        <div className="mt-3 w-full bg-red-200 rounded-full h-2">
                                                            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(pcl5Responses[0].total_score / 80) * 100}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            {new Date(pcl5Responses[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-slate-500 mt-2">No data recorded</p>
                                                        <div className="mt-3 w-full bg-red-200 rounded-full h-2">
                                                            <div className="bg-red-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score Trends Chart */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                                                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                    </svg>
                                                    <span>Score Trends</span>
                                                </h3>
                                                {/* X-Axis toggle */}
                                                <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-0.5">
                                                    <button onClick={() => setChartXAxis('attempt')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartXAxis === 'attempt' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Attempts</button>
                                                    <button onClick={() => setChartXAxis('date')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartXAxis === 'date' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Date</button>
                                                </div>
                                            </div>
                                            {/* Assessment type filter */}
                                            <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1 mb-4 overflow-x-auto">
                                                {[
                                                    { key: 'all', label: 'All' },
                                                    { key: 'PHQ9', label: 'PHQ-9' },
                                                    { key: 'GAD7', label: 'GAD-7' },
                                                    { key: 'PCL5', label: 'PCL-5' },
                                                    { key: 'AUDIT', label: 'AUDIT' },
                                                    { key: 'CAGE', label: 'CAGE' },
                                                    { key: 'MDQ', label: 'MDQ' },
                                                ].map(f => (
                                                    <button
                                                        key={f.key}
                                                        onClick={() => setChartFilter(f.key)}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${chartFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {(() => {
                                                const chartData = buildChartData()
                                                if (chartData.length === 0) return (
                                                    <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                        No assessment data to chart. Take some assessments first.
                                                    </div>
                                                )
                                                const visibleKeys = chartFilter === 'all' ? CHART_LINES.map(l => l.key) : [chartFilter]
                                                const visibleLines = CHART_LINES.filter(l => visibleKeys.includes(l.key))
                                                // Determine Y axis max: if single type use its max, if all use the highest max among types that have data
                                                const yMax = chartFilter !== 'all'
                                                    ? (CHART_LINES.find(l => l.key === chartFilter)?.max || 27)
                                                    : Math.max(...visibleLines.filter(l => l.responses.length > 0).map(l => l.max), 27)
                                                return (
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                            <XAxis
                                                                dataKey={chartXAxis === 'date' ? 'dateLabel' : 'attempt'}
                                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                                label={chartXAxis === 'attempt' ? { value: 'Attempt', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' } : undefined}
                                                            />
                                                            <YAxis domain={[0, yMax]} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                                labelFormatter={(label) => chartXAxis === 'attempt' ? `Attempt ${label}` : label}
                                                                formatter={(value, name) => {
                                                                    const line = CHART_LINES.find(l => l.name === name)
                                                                    return [`${value} / ${line ? line.max : '?'}`, name]
                                                                }}
                                                            />
                                                            <Legend />
                                                            {visibleLines.map(line => (
                                                                <Line
                                                                    key={line.key}
                                                                    type="monotone"
                                                                    dataKey={line.key}
                                                                    name={line.name}
                                                                    stroke={line.color}
                                                                    strokeWidth={2.5}
                                                                    dot={{ r: 5, fill: line.color }}
                                                                    activeDot={{ r: 7 }}
                                                                    connectNulls
                                                                />
                                                            ))}
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                )
                                            })()}
                                        </div>

                                        {/* Available Assessments */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                                <span>Available Assessments</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { name: 'PHQ-9', key: 'PHQ9', description: 'Patient Health Questionnaire - Depression', time: '3 min', color: 'blue', active: true },
                                                    { name: 'GAD-7', key: 'GAD7', description: 'Generalized Anxiety Disorder Scale', time: '2 min', color: 'purple', active: true },
                                                    { name: 'PCL-5', key: 'PCL5', description: 'PTSD Checklist for DSM-5', time: '5 min', color: 'red', active: true },
                                                    { name: 'AUDIT', key: 'AUDIT', description: 'Alcohol Use Disorders Identification', time: '3 min', color: 'orange', active: true },
                                                    { name: 'CAGE', key: 'CAGE', description: 'Substance Abuse Screening', time: '1 min', color: 'yellow', active: true },
                                                    { name: 'MDQ', key: 'MDQ', description: 'Mood Disorder Questionnaire', time: '3 min', color: 'teal', active: true }
                                                ].map((assessment, index) => (
                                                    <div key={index} className={`flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-all group ${assessment.active ? 'cursor-pointer' : 'opacity-60'}`}>
                                                        <div className="flex items-center space-x-4">
                                                            <div className={`w-12 h-12 bg-${assessment.color}-100 rounded-xl flex items-center justify-center`}>
                                                                <span className={`text-lg font-bold text-${assessment.color}-600`}>{assessment.name.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{assessment.name}</h4>
                                                                <p className="text-sm text-slate-500">{assessment.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-xs font-medium text-slate-400">{assessment.time}</span>
                                                            {assessment.active ? (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setAssessmentMenuOpen(assessmentMenuOpen === assessment.key ? null : assessment.key) }}
                                                                        disabled={assessmentLinkLoading}
                                                                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 flex items-center space-x-1.5"
                                                                    >
                                                                        <span>Start</span>
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                                    </button>
                                                                    {assessmentMenuOpen === assessment.key && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-10" onClick={() => setAssessmentMenuOpen(null)} />
                                                                            <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                                                                                <button
                                                                                    onClick={() => handleGenerateAssessmentLink(assessment.key, true)}
                                                                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 hover:bg-slate-50"
                                                                                >
                                                                                    <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                    </svg>
                                                                                    <div>
                                                                                        <p className="font-semibold text-slate-800">Take Test Now</p>
                                                                                        <p className="text-xs text-slate-400">Open in new tab</p>
                                                                                    </div>
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleGenerateAssessmentLink(assessment.key, false)}
                                                                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 hover:bg-slate-50"
                                                                                >
                                                                                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                                    </svg>
                                                                                    <div>
                                                                                        <p className="font-semibold text-slate-800">Copy Link</p>
                                                                                        <p className="text-xs text-slate-400">Send to patient</p>
                                                                                    </div>
                                                                                </button>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 font-medium">Soon</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Generated Assessment Link */}
                                        {assessmentLink && (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                                                <h4 className="font-bold text-green-800 mb-2 flex items-center space-x-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                    <span>Assessment Link Generated</span>
                                                </h4>
                                                <p className="text-sm text-green-700 mb-3">Send this link to the patient. It expires in 7 days and requires no login.</p>
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={assessmentLink}
                                                        className="flex-1 px-4 py-2.5 bg-white border border-green-300 rounded-lg text-sm text-slate-700 font-mono"
                                                    />
                                                    <button
                                                        onClick={handleCopyLink}
                                                        className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center space-x-1.5 ${linkCopied ? 'bg-green-600 text-white' : 'bg-white border border-green-300 text-green-700 hover:bg-green-100'}`}
                                                    >
                                                        {linkCopied ? (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                                <span>Copied</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                                <span>Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Past PHQ-9 Responses */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                <span>PHQ-9 History</span>
                                                <span className="text-sm font-normal text-slate-400">({assessmentResponses.length} record{assessmentResponses.length !== 1 ? 's' : ''})</span>
                                            </h3>
                                            {assessmentResponsesLoading ? (
                                                <div className="space-y-3 animate-pulse">
                                                    {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>)}
                                                </div>
                                            ) : assessmentResponses.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    {selectedPatientId ? 'No PHQ-9 assessments taken yet for this patient.' : 'Select a patient to view assessment history.'}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {assessmentResponses.map((resp, idx) => {
                                                        const interp = getPhq9Interpretation(resp.total_score)
                                                        const d = new Date(resp.created_at)
                                                        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                        const prevScore = idx < assessmentResponses.length - 1 ? assessmentResponses[idx + 1].total_score : null
                                                        return (
                                                            <div key={resp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                                        <span className="font-bold text-blue-600">P</span>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-slate-800">PHQ-9</h4>
                                                                        <p className="text-sm text-slate-500">{dateStr} at {timeStr}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="text-right">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-lg font-bold text-slate-800">{resp.total_score}/27</span>
                                                                            {prevScore !== null && (
                                                                                <span className={`text-sm font-bold ${resp.total_score < prevScore ? 'text-green-600' : resp.total_score > prevScore ? 'text-red-600' : 'text-slate-400'}`}>
                                                                                    {resp.total_score < prevScore ? '↓' : resp.total_score > prevScore ? '↑' : '='}{resp.total_score !== prevScore ? ` ${Math.abs(resp.total_score - prevScore)}` : ''}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${interp.bg} ${interp.color}`}>
                                                                            {interp.label}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* GAD-7 History */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                <span>GAD-7 History</span>
                                                <span className="text-sm font-normal text-slate-400">({gad7Responses.length} record{gad7Responses.length !== 1 ? 's' : ''})</span>
                                            </h3>
                                            {assessmentResponsesLoading ? (
                                                <div className="space-y-3 animate-pulse">
                                                    {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>)}
                                                </div>
                                            ) : gad7Responses.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    {selectedPatientId ? 'No GAD-7 assessments taken yet for this patient.' : 'Select a patient to view assessment history.'}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {gad7Responses.map((resp, idx) => {
                                                        const interp = getGad7Interpretation(resp.total_score)
                                                        const d = new Date(resp.created_at)
                                                        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                        const prevScore = idx < gad7Responses.length - 1 ? gad7Responses[idx + 1].total_score : null
                                                        return (
                                                            <div key={resp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                                                        <span className="font-bold text-purple-600">G</span>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-slate-800">GAD-7</h4>
                                                                        <p className="text-sm text-slate-500">{dateStr} at {timeStr}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="text-right">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-lg font-bold text-slate-800">{resp.total_score}/21</span>
                                                                            {prevScore !== null && (
                                                                                <span className={`text-sm font-bold ${resp.total_score < prevScore ? 'text-green-600' : resp.total_score > prevScore ? 'text-red-600' : 'text-slate-400'}`}>
                                                                                    {resp.total_score < prevScore ? '↓' : resp.total_score > prevScore ? '↑' : '='}{resp.total_score !== prevScore ? ` ${Math.abs(resp.total_score - prevScore)}` : ''}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${interp.bg} ${interp.color}`}>
                                                                            {interp.label}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (() => {
                                const sessionHistory = buildSessionHistory()
                                return (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">Session History</h3>
                                            <span className="text-sm text-slate-500">{sessionHistory.length} session{sessionHistory.length !== 1 ? 's' : ''}</span>
                                        </div>

                                        {notesLoading ? (
                                            <div className="space-y-4 animate-pulse">
                                                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl"></div>)}
                                            </div>
                                        ) : sessionHistory.length === 0 ? (
                                            <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-slate-500 font-medium">No sessions yet</p>
                                                <p className="text-sm text-slate-400 mt-1">Session notes, recordings, and assessments will appear here</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {sessionHistory.map(session => {
                                                    const dateStr = session.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                    const timeStr = session.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                    const isExpanded = expandedSessionId === session.id
                                                    const hasNote = !!session.note
                                                    const hasRecording = !!session.recording
                                                    const hasTranscript = !!(session.recording?.transcript)
                                                    const hasReport = !!session.aiInsights
                                                    const hasAssessments = session.assessments.length > 0

                                                    return (
                                                        <div key={session.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                                            {/* Session header */}
                                                            <div
                                                                className="p-5 cursor-pointer"
                                                                onClick={() => { setExpandedSessionId(isExpanded ? null : session.id); setExpandedSessionSection(null) }}
                                                            >
                                                                <div className="flex items-start justify-between mb-3">
                                                                    <div className="flex items-center space-x-3">
                                                                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                                                                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-bold text-slate-800">{session.patientName}</span>
                                                                            <p className="text-xs text-slate-500">{dateStr} at {timeStr}</p>
                                                                        </div>
                                                                    </div>
                                                                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                                </div>
                                                                {/* Badges */}
                                                                <div className="flex flex-wrap gap-2">
                                                                    {hasNote && <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>Notes</span></span>}
                                                                    {hasRecording && <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg><span>Recording</span></span>}
                                                                    {hasTranscript && <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>Transcript</span></span>}
                                                                    {hasReport && <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>Report</span></span>}
                                                                    {hasAssessments && <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg><span>{session.assessments.length} Score{session.assessments.length > 1 ? 's' : ''}</span></span>}
                                                                </div>
                                                            </div>

                                                            {/* Expanded content */}
                                                            {isExpanded && (
                                                                <div className="border-t border-slate-200">
                                                                    {/* Section tabs */}
                                                                    <div className="flex border-b border-slate-100 px-5 pt-3 space-x-1 overflow-x-auto">
                                                                        {[
                                                                            hasNote && { key: 'notes', label: 'Notes' },
                                                                            hasRecording && { key: 'audio', label: 'Recording' },
                                                                            hasTranscript && { key: 'transcript', label: 'Transcript' },
                                                                            hasReport && { key: 'report', label: 'AI Report' },
                                                                            hasAssessments && { key: 'scores', label: 'Scores' },
                                                                        ].filter(Boolean).map(tab => (
                                                                            <button
                                                                                key={tab.key}
                                                                                onClick={(e) => { e.stopPropagation(); setExpandedSessionSection(expandedSessionSection === tab.key ? null : tab.key) }}
                                                                                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap ${expandedSessionSection === tab.key ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                                                            >
                                                                                {tab.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>

                                                                    {/* Section content */}
                                                                    <div className="p-5">
                                                                        {/* Notes */}
                                                                        {expandedSessionSection === 'notes' && session.note && (
                                                                            <div>
                                                                                <div className="flex items-center justify-between mb-3">
                                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${session.note.status === 'Finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{session.note.status}</span>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setViewingNote(session.note) }}
                                                                                        className="text-xs font-bold text-primary-600 hover:text-primary-700"
                                                                                    >View Full / Edit</button>
                                                                                </div>
                                                                                <div className="prose prose-sm prose-slate max-w-none max-h-64 overflow-y-auto bg-slate-50 rounded-lg p-4 border border-slate-100" dangerouslySetInnerHTML={{ __html: session.note.content }} />
                                                                            </div>
                                                                        )}

                                                                        {/* Audio Recording */}
                                                                        {expandedSessionSection === 'audio' && session.recording && (
                                                                            <div>
                                                                                <div className="flex items-center space-x-4 mb-3">
                                                                                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                                                                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                                                    </div>
                                                                                    <div className="text-sm text-slate-500">
                                                                                        {session.recording.duration && <span>{Math.floor(session.recording.duration / 60)}m {session.recording.duration % 60}s</span>}
                                                                                        {session.recording.file_size && <span> &bull; {session.recording.file_size < 1024 * 1024 ? (session.recording.file_size / 1024).toFixed(1) + ' KB' : (session.recording.file_size / (1024 * 1024)).toFixed(1) + ' MB'}</span>}
                                                                                        {session.recording.format && <span> &bull; <span className="uppercase text-xs font-semibold">{session.recording.format}</span></span>}
                                                                                    </div>
                                                                                </div>
                                                                                {session.recording.audio_url ? (
                                                                                    <div>
                                                                                        <audio controls className="w-full" src={getAudioUrl(session.recording.audio_url, session.recording.id)} preload="metadata">Your browser does not support audio.</audio>
                                                                                        <button
                                                                                            onClick={() => handleDownloadAudio(session.recording.id, session.recording.format)}
                                                                                            className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                                                                                        >
                                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                                            <span>Download Audio</span>
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-700">Audio file not available.</div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* Transcript */}
                                                                        {expandedSessionSection === 'transcript' && session.recording?.transcript && (
                                                                            <div className="max-h-64 overflow-y-auto bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{session.recording.transcript}</p>
                                                                            </div>
                                                                        )}

                                                                        {/* AI Report */}
                                                                        {expandedSessionSection === 'report' && session.aiInsights && (() => {
                                                                            const report = session.aiInsights
                                                                            return (
                                                                                <div className="space-y-3">
                                                                                    {report.overview && (
                                                                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                                                            <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Overview</h5>
                                                                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                                {report.overview.mood && <div><span className="text-slate-500">Mood:</span> <span className="font-semibold text-slate-800">{report.overview.mood}</span></div>}
                                                                                                {report.overview.moodScore && <div><span className="text-slate-500">Score:</span> <span className="font-semibold text-slate-800">{report.overview.moodScore}/10</span></div>}
                                                                                                {report.overview.affect && <div><span className="text-slate-500">Affect:</span> <span className="font-semibold text-slate-800">{report.overview.affect}</span></div>}
                                                                                                {report.overview.engagement && <div><span className="text-slate-500">Engagement:</span> <span className="font-semibold text-slate-800">{report.overview.engagement}</span></div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                    {report.symptoms?.reported?.length > 0 && (
                                                                                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                                                                            <h5 className="text-xs font-bold text-orange-400 uppercase mb-2">Symptoms</h5>
                                                                                            <div className="flex flex-wrap gap-1.5">{report.symptoms.reported.map((s, i) => <span key={i} className="px-2 py-0.5 bg-white text-orange-700 text-xs rounded-lg border border-orange-200">{s}</span>)}</div>
                                                                                        </div>
                                                                                    )}
                                                                                    {report.clinicalImpression?.possibleDiagnoses?.length > 0 && (
                                                                                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                                                            <h5 className="text-xs font-bold text-purple-400 uppercase mb-2">DSM-5 Indications</h5>
                                                                                            {report.clinicalImpression.possibleDiagnoses.map((d, i) => <div key={i} className="text-sm"><span className="font-mono text-purple-500 mr-1">{d.code}</span><span className="font-semibold text-slate-800">{d.name}</span>{d.confidence && <span className="text-xs text-purple-500 ml-2">({d.confidence})</span>}</div>)}
                                                                                        </div>
                                                                                    )}
                                                                                    {report.treatmentPlan?.recommendations?.length > 0 && (
                                                                                        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                                                                            <h5 className="text-xs font-bold text-teal-400 uppercase mb-2">Recommendations</h5>
                                                                                            <ul className="text-sm text-slate-700 space-y-1">{report.treatmentPlan.recommendations.map((r, i) => <li key={i} className="flex items-start space-x-1.5"><span className="text-teal-500 mt-0.5">&#8226;</span><span>{r}</span></li>)}</ul>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })()}

                                                                        {/* Assessment Scores */}
                                                                        {expandedSessionSection === 'scores' && session.assessments.length > 0 && (
                                                                            <div className="space-y-2">
                                                                                {session.assessments.map((a, i) => {
                                                                                    const typeLabel = { PHQ9: 'PHQ-9', GAD7: 'GAD-7', PCL5: 'PCL-5', AUDIT: 'AUDIT', CAGE: 'CAGE', MDQ: 'MDQ' }[a._type] || a.assessment_type
                                                                                    const maxScore = { PHQ9: 27, GAD7: 21, PCL5: 80, AUDIT: 40, CAGE: 4, MDQ: 13 }[a._type] || 27
                                                                                    const interpFn = { PHQ9: getPhq9Interpretation, GAD7: getGad7Interpretation, PCL5: getPcl5Interpretation, AUDIT: getAuditInterpretation, CAGE: getCageInterpretation, MDQ: getMdqInterpretation }[a._type]
                                                                                    const interp = interpFn ? interpFn(a.total_score) : { label: '', color: 'text-slate-700', bg: 'bg-slate-100' }
                                                                                    return (
                                                                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                                                            <div className="flex items-center space-x-3">
                                                                                                <span className="text-sm font-bold text-slate-800">{typeLabel}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center space-x-3">
                                                                                                <span className="text-sm font-bold text-slate-800">{a.total_score}/{maxScore}</span>
                                                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${interp.bg} ${interp.color}`}>{interp.label}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                        {/* No section selected prompt */}
                                                                        {!expandedSessionSection && (
                                                                            <p className="text-sm text-slate-400 text-center py-4">Select a tab above to view session details</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )
                            })()}

                            {activeTab === 'export' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Select Note to Export */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>Select Note to Export</span>
                                            </h3>
                                            <div className="space-y-3">
                                                {/* Current editor option */}
                                                <button
                                                    onClick={() => setExportSelectedNoteId('current')}
                                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${exportSelectedNoteId === 'current' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${exportSelectedNoteId === 'current' ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">Current Editor Content</p>
                                                                <p className="text-xs text-slate-500">Export what's currently in the editor</p>
                                                            </div>
                                                        </div>
                                                        {exportSelectedNoteId === 'current' && (
                                                            <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Divider */}
                                                {savedNotes.length > 0 && (
                                                    <div className="flex items-center space-x-3 py-1">
                                                        <div className="flex-1 h-px bg-slate-200"></div>
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Saved Notes</span>
                                                        <div className="flex-1 h-px bg-slate-200"></div>
                                                    </div>
                                                )}

                                                {/* Saved notes list */}
                                                <div className="max-h-72 overflow-y-auto space-y-2">
                                                    {savedNotes.map(note => {
                                                        const d = new Date(note.created_at)
                                                        const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                        const timeLabel = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                        const plainText = (note.content?.replace(/<[^>]*>/g, '') || '').replace(/\s*—?\s*click to annotate\s*/gi, ' ').replace(/\s+/g, ' ').trim()
                                                        const preview = plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText
                                                        const isSelected = String(exportSelectedNoteId) === String(note.id)

                                                        return (
                                                            <button
                                                                key={note.id}
                                                                onClick={() => setExportSelectedNoteId(String(note.id))}
                                                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center space-x-3 min-w-0">
                                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center space-x-2 mb-0.5">
                                                                                <p className="font-bold text-slate-800 text-sm truncate">{note.patient_name || 'Unknown Patient'}</p>
                                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${note.status === 'Finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                    {note.status}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-500">{dateLabel} at {timeLabel}</p>
                                                                            <p className="text-xs text-slate-400 mt-1 truncate">{preview}</p>
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <svg className="w-5 h-5 text-primary-600 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {savedNotes.length === 0 && (
                                                    <div className="py-4 text-center text-sm text-slate-400">
                                                        No saved notes yet. Only current editor content can be exported.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Export Format Selection */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>Export Format</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { format: 'PDF', color: 'text-red-500 bg-red-50', description: 'Professional clinical report format' },
                                                    // { format: 'Word', color: 'text-blue-500 bg-blue-50', description: 'Editable document format (.doc)' }
                                                ].map((option, index) => (
                                                    <button key={index} onClick={() => setExportFormat(option.format)} className={`relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${exportFormat === option.format ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        {exportFormat === option.format && (
                                                            <span className="absolute -top-2 right-4 text-xs font-semibold px-2 py-0.5 bg-primary-600 text-white rounded-full">
                                                                Selected
                                                            </span>
                                                        )}
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${option.color}`}>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                        <h4 className="font-bold text-slate-800 mb-1">{option.format}</h4>
                                                        <p className="text-sm text-slate-500">{option.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Include Report Toggle */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">Include AI Clinical Report</p>
                                                        <p className="text-sm text-slate-500">Append session overview, symptoms, risk assessment, DSM-5 indications, and treatment plan</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setExportIncludeReport(!exportIncludeReport)}
                                                    className={`relative w-12 h-7 rounded-full transition-colors ${exportIncludeReport ? 'bg-primary-600' : 'bg-slate-300'}`}
                                                >
                                                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${exportIncludeReport ? 'translate-x-5.5 left-0' : 'left-0.5'}`}
                                                        style={{ transform: exportIncludeReport ? 'translateX(22px)' : 'translateX(0)' }}
                                                    />
                                                </button>
                                            </div>
                                            {exportIncludeReport && (() => {
                                                // Check if selected note has insights
                                                let hasInsights = false
                                                if (exportSelectedNoteId === 'current') {
                                                    hasInsights = !!aiSummary
                                                } else {
                                                    const allNotes = [...savedNotes, ...patientSessions]
                                                    const note = allNotes.find(n => String(n.id) === String(exportSelectedNoteId))
                                                    hasInsights = !!(note?.ai_insights)
                                                }
                                                return !hasInsights ? (
                                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center space-x-2">
                                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        <span>No AI report available for the selected note. The export will include only the note content.</span>
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center space-x-2">
                                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>AI report will be appended to the export.</span>
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* Export Button */}
                                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="font-semibold text-slate-800">Ready to export</p>
                                                <p className="text-sm text-slate-500">
                                                    {exportFormat} format{exportIncludeReport ? ' + AI Report' : ''} — {exportSelectedNoteId === 'current'
                                                        ? 'Current editor content'
                                                        : (() => {
                                                            const n = savedNotes.find(s => String(s.id) === String(exportSelectedNoteId))
                                                            if (!n) return 'Selected note'
                                                            const d = new Date(n.created_at)
                                                            return (n.patient_name || 'Unknown') + ' — ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                                                        })()
                                                    }
                                                </p>
                                            </div>
                                            <button onClick={handleDownloadExport} className="btn-primary px-8 py-3 flex items-center space-x-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                <span>Download</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Right (1/4) */}
                    <div className="space-y-6">
                        {/* Templates */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <span>Templates</span>
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {templateOptions.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleApplyTemplate(template.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors flex items-center space-x-3 ${selectedTemplate === template.id
                                            ? 'bg-primary-50 border-2 border-primary-600'
                                            : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                            }`}
                                    >
                                        {templateIcons[template.id]}
                                        <span className="text-sm font-medium text-slate-700">{template.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Session Info */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Session Info</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.date}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Duration</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.duration}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Type</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.type}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                        {sessionInfo.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
                            <div className="space-y-2">
                                {quickActions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={action.onClick}
                                        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-3 border-2 border-transparent hover:border-slate-200"
                                    >
                                        {quickActionIcons[action.label]}
                                        <span className="text-sm font-medium text-slate-700">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Annotation Overlay */}
            {annotationOverlay && (
                <ImageAnnotationOverlay
                    imageSrc={annotationOverlay.imageSrc}
                    imageId={annotationOverlay.imageId}
                    imageLabel={annotationOverlay.imageLabel}
                    annotations={annotationOverlay.annotations}
                    onSave={handleAnnotationSave}
                    onClose={() => setAnnotationOverlay(null)}
                />
            )}

            {/* View Note Modal */}
            {viewingNote && (() => {
                const noteDate = new Date(viewingNote.created_at)
                const dateStr = noteDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                const timeStr = noteDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
                        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <div>
                                    <div className="flex items-center space-x-3 mb-1">
                                        <h2 className="text-xl font-bold text-slate-800">{viewingNote.patient_name || 'Unknown Patient'}</h2>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${viewingNote.status === 'Finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {viewingNote.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">{dateStr} at {timeStr}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => {
                                            if (editorRef.current) {
                                                editorRef.current.innerHTML = viewingNote.content
                                                setNoteContent(viewingNote.content)
                                            }
                                            setSelectedPatientId(viewingNote.patient_id?.toString() || selectedPatientId)
                                            setEditingNoteId(viewingNote.id)
                                            setSelectedSessionId(String(viewingNote.id))

                                            // Load AI insights from the note
                                            if (viewingNote.ai_insights) {
                                                try {
                                                    const insights = typeof viewingNote.ai_insights === 'string' ? JSON.parse(viewingNote.ai_insights) : viewingNote.ai_insights
                                                    setAiSummary(insights)
                                                    setClinicalSummary(insights)
                                                } catch {
                                                    setAiSummary(null)
                                                    setClinicalSummary(null)
                                                }
                                            }

                                            setViewingNote(null)
                                            setActiveTab('editor')
                                        }}
                                        className="px-3 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center space-x-1.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Edit Note</span>
                                    </button>
                                    <button
                                        onClick={() => setViewingNote(null)}
                                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {/* Content */}
                            <div className="p-6 overflow-y-auto">
                                <div
                                    ref={noteViewContentRef}
                                    className="prose prose-slate max-w-none text-slate-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: viewingNote.content }}
                                />
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* AI Clinical Summary Modal */}
            {showSummaryModal && clinicalSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-4xl my-8 shadow-2xl overflow-hidden">
                        <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
                            <h2 className="text-2xl font-bold text-white">AI Clinical Summary</h2>
                            <button onClick={() => setShowSummaryModal(false)} className="text-white hover:text-indigo-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase mb-2">Mood & Affect</h4>
                                    <p className="text-slate-800 font-medium">{clinicalSummary.overview?.mood} / {clinicalSummary.overview?.affect}</p>
                                </div>
                                <div className="p-6 bg-purple-50 rounded-xl border border-purple-100">
                                    <h4 className="text-xs font-bold text-purple-600 uppercase mb-2">Engagement</h4>
                                    <p className="text-slate-800 font-medium">{clinicalSummary.overview?.engagement}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase mb-3 flex items-center">
                                        <span>DSM-5 Indications</span>
                                    </h4>
                                    {clinicalSummary.clinicalImpression?.possibleDiagnoses?.length > 0 ? (
                                        <div className="space-y-3">
                                            {clinicalSummary.clinicalImpression.possibleDiagnoses.map((dx, i) => (
                                                <div key={i} className="bg-white p-3 rounded-lg border border-indigo-50 shadow-sm">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-slate-800 text-sm">{dx.name}</span>
                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">{dx.code}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">{dx.criteria_met}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm italic">No specific DSM-5 matches found.</p>
                                    )}
                                </div>

                                <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-100">
                                    <h4 className="text-xs font-bold text-yellow-700 uppercase mb-3 flex items-center">
                                        <span>Reported Symptoms</span>
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {clinicalSummary.symptoms?.reported?.map((sym, i) => (
                                            <span key={i} className="px-3 py-1 bg-white border border-yellow-200 text-yellow-800 rounded-full text-xs font-medium shadow-sm">
                                                {sym}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-yellow-200/50">
                                        <p className="text-xs font-bold text-yellow-800">Severity Assessment: <span className="font-normal">{clinicalSummary.symptoms?.severity}</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-end space-x-4">
                                <button
                                    onClick={() => {
                                        const selectedPatientData = patients.find(p => p.id === parseInt(selectedPatientId));
                                        const patientName = selectedPatientData?.full_name || 'Patient';
                                        exportClinicalSummaryToPDF(clinicalSummary, patientName, null, {
                                            patientId: selectedPatientData?.id,
                                        });
                                    }}
                                    className="px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl transition-all flex items-center space-x-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                    </svg>
                                    <span>Export Summary</span>
                                </button>
                                <button
                                    onClick={() => setShowSummaryModal(false)}
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-200 transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generating Summary Loader */}
            {generatingSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Clinical Summary...</h3>
                        <p className="text-slate-500">Analyzing transcript with AI</p>
                    </div>
                </div>
            )}

            {/* Clear All Confirmation */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Clear Editor</h3>
                            <p className="text-sm text-slate-500">Are you sure you want to clear all content from the editor? This action cannot be undone.</p>
                        </div>
                        <div className="px-6 pb-6 flex items-center justify-center space-x-3">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (editorRef.current) {
                                        editorRef.current.innerHTML = ''
                                    }
                                    setNoteContent('')
                                    setCharCount(0)
                                    setSelectedTemplate(null)
                                    setShowClearConfirm(false)
                                }}
                                className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SessionNotes
