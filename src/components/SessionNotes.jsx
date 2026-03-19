import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { noteService, aiService, imageService } from '../services/api'
import ImageAnnotationOverlay from './ImageAnnotationOverlay'

const API_URL = import.meta.env.VITE_BACKEND_URL

const SessionNotes = () => {
    const location = useLocation()
    const [activeTab, setActiveTab] = useState('editor')
    const [noteContent, setNoteContent] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [transcriptData, setTranscriptData] = useState(null)
    const [aiSummary, setAiSummary] = useState(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
    const [isSymptomReportLoading, setIsSymptomReportLoading] = useState(false)
    const [symptomReport, setSymptomReport] = useState(null)
    const [libraryImages, setLibraryImages] = useState([])
    const [isImagePickerOpen, setIsImagePickerOpen] = useState(false)
    const [charCount, setCharCount] = useState(0)
    const [annotationOverlay, setAnnotationOverlay] = useState(null)

    const editorRef = useRef(null)
    const savedSelectionRef = useRef(null)

    const getImageUrl = (imageUrl) => {
        if (!imageUrl) return ''
        const baseUrl = API_URL.replace('/api', '')
        return `${baseUrl}${imageUrl}`
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
    }, [])

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
        editor.addEventListener('click', handleEditorClick)
        return () => editor.removeEventListener('click', handleEditorClick)
    }, [handleEditorClick])

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
        cleanImg.title = 'Click to add labels'

        // Remove the old overlay if it exists
        if (existingOverlay) {
            existingOverlay.remove()
        }
        // Remove the old bare img if it's still directly in wrapper
        const remainingImg = wrapper.querySelector('img')
        if (remainingImg) remainingImg.remove()

        // Find the caption div (last child div with font-size 11px)
        const caption = wrapper.querySelector('div[style*="font-size"]')

        if (annotations.length > 0) {
            // Create a container that wraps the image + annotation pins/labels
            const imgContainer = document.createElement('div')
            imgContainer.className = 'annotation-overlay'
            imgContainer.setAttribute('contenteditable', 'false')
            imgContainer.style.cssText = 'position:relative;display:inline-block;cursor:pointer;'

            imgContainer.appendChild(cleanImg)

            // SVG for connector lines
            let svgLines = ''
            annotations.forEach(ann => {
                const lx = ann.xPct > 60 ? ann.xPct - 18 : ann.xPct + 10
                const ly = ann.yPct > 15 ? ann.yPct - 10 : ann.yPct + 10
                svgLines += `<line x1="${ann.xPct}%" y1="${ann.yPct}%" x2="${lx}%" y2="${ly}%" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4 2" />`
            })
            const svgTmp = document.createElement('div')
            svgTmp.innerHTML = `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${svgLines}</svg>`
            imgContainer.appendChild(svgTmp.firstChild)

            // Pins and labels
            annotations.forEach(ann => {
                const lx = ann.xPct > 60 ? ann.xPct - 18 : ann.xPct + 10
                const ly = ann.yPct > 15 ? ann.yPct - 10 : ann.yPct + 10

                const pin = document.createElement('div')
                pin.style.cssText = `position:absolute;left:${ann.xPct}%;top:${ann.yPct}%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#0284c7;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);z-index:2;pointer-events:none;`
                imgContainer.appendChild(pin)

                const label = document.createElement('div')
                label.style.cssText = `position:absolute;left:${lx}%;top:${ly}%;transform:translate(-50%,-50%);background:white;border:1px solid #0284c7;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;color:#0369a1;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);z-index:3;pointer-events:none;`
                label.textContent = ann.label
                imgContainer.appendChild(label)
            })

            // Insert the annotated container before caption
            if (caption) {
                wrapper.insertBefore(imgContainer, caption)
            } else {
                wrapper.appendChild(imgContainer)
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
        `<span style="font-size:10px;color:#94a3b8;">DynaCare &mdash; HIPAA Compliant Mental Health Platform</span>` +
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

    const handleSaveNote = async () => {
        const content = getEditorContent()
        const textContent = getEditorTextContent()

        if (!textContent.trim()) {
            alert("Please enter some content before saving.");
            return;
        }

        setIsSaving(true);
        try {
            const noteData = {
                patient_id: location.state?.patientId || 1,
                appointment_id: location.state?.appointmentId || null,
                content: content,
                status: 'Finalized',
                ai_insights: aiSummary ? JSON.stringify(aiSummary) : null
            };

            await noteService.create(noteData);
            alert("Note saved and finalized successfully!");
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note: " + (error.response?.data?.message || error.message));
        } finally {
            setIsSaving(false);
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
        { label: 'Export Report' },
        { label: 'Schedule Follow-up' }
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
                        <button className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Schedule Follow-up</span>
                        </button>
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
                                                        <span>📋</span>
                                                        <span>Templates</span>
                                                        <span className="text-[10px] ml-1">{isTemplatesOpen ? '▲' : '▼'}</span>
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
                                                    onClick={handleGetSymptomReport}
                                                    disabled={isSymptomReportLoading || (!getEditorTextContent() && !transcriptData)}
                                                    className={`px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-indigo-200 ${(isSymptomReportLoading || (!getEditorTextContent() && !transcriptData)) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSymptomReportLoading ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : '🔍'}
                                                    <span>{isSymptomReportLoading ? 'Analyzing...' : 'Symptoms Report'}</span>
                                                </button>
                                                <button
                                                    onClick={handleSaveNote}
                                                    disabled={isSaving}
                                                    className={`btn-primary text-sm flex items-center space-x-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSaving ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : '💾'}
                                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
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

                                    {/* AI Writing Assistant */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                                <span className="text-white">✨</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-800 mb-1">AI Writing Assistant</h4>
                                                <p className="text-sm text-slate-600 mb-3">
                                                    Get AI-powered suggestions to enhance your clinical documentation and ensure comprehensive coverage.
                                                </p>
                                                <div className="flex items-center space-x-3">
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Improve Grammar
                                                    </button>
                                                    <span className="text-slate-300">•</span>
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Add Clinical Details
                                                    </button>
                                                    <span className="text-slate-300">•</span>
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Summarize Key Points
                                                    </button>
                                                </div>
                                            </div>
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
                                                        <span>🔍</span>
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
                                                    <button
                                                        onClick={() => {
                                                            if (editorRef.current) {
                                                                editorRef.current.innerHTML += `<hr><p><b>Symptom Report</b></p><p><b>Impression:</b> ${symptomReport.overall_impression}</p><p><b>Symptoms Found:</b> ${symptomReport.symptoms.map(s => `${s.symptom} (${s.severity})`).join(', ')}</p>`
                                                                setNoteContent(getEditorContent())
                                                            }
                                                        }}
                                                        className="mt-6 w-full py-3 bg-white border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center space-x-2"
                                                    >
                                                        <span>📋</span>
                                                        <span>Append Report to Notes</span>
                                                    </button>
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
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-slate-800 flex items-center space-x-2">
                                                    <span>🎤</span>
                                                    <span>Session Transcript</span>
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        if (editorRef.current) {
                                                            const escaped = transcriptData.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
                                                            editorRef.current.innerHTML += `<hr><p><b>Transcript</b></p><p>${escaped}</p>`
                                                            setNoteContent(getEditorContent())
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-bold hover:bg-primary-100 transition-all flex items-center space-x-2"
                                                >
                                                    <span>📋</span>
                                                    <span>Copy to Notes</span>
                                                </button>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-h-[600px] overflow-y-auto">
                                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-lg">
                                                    {transcriptData}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    <strong>💡 Tip:</strong> You can select portions of this transcript to refine your clinical notes or use the "Copy to Notes" button to append the entire text.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Transcript Available</h3>
                                            <p className="text-slate-500 mb-6">Upload a session recording to generate an AI transcript</p>
                                            <button className="btn-primary">
                                                Upload Recording
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other tabs placeholder */}
                            {activeTab === 'assessments' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Assessment Overview */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">📊</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-blue-200 text-blue-700 rounded-full">Latest</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">PHQ-9 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-blue-600">8</span>
                                                    <span className="text-sm text-slate-600">/ 27</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">🧠</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-purple-200 text-purple-700 rounded-full">N/A</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">GAD-7 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-purple-600">--</span>
                                                    <span className="text-sm text-slate-600">/ 21</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">💪</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-green-200 text-green-700 rounded-full">N/A</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">WHODAS 2.0</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-green-600">--</span>
                                                    <span className="text-sm text-slate-600">/ 100</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-green-200 rounded-full h-2">
                                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Available Assessments */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📋</span>
                                                <span>Available Assessments</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { name: 'PHQ-9', description: 'Patient Health Questionnaire - Depression', time: '3 min', color: 'blue' },
                                                    { name: 'GAD-7', description: 'Generalized Anxiety Disorder Scale', time: '2 min', color: 'purple' },
                                                    { name: 'PCL-5', description: 'PTSD Checklist for DSM-5', time: '5 min', color: 'red' },
                                                    { name: 'AUDIT', description: 'Alcohol Use Disorders Identification', time: '3 min', color: 'orange' },
                                                    { name: 'CAGE', description: 'Substance Abuse Screening', time: '1 min', color: 'yellow' },
                                                    { name: 'MDQ', description: 'Mood Disorder Questionnaire', time: '3 min', color: 'teal' }
                                                ].map((assessment, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-all cursor-pointer group">
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
                                                            <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Start
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Assessment History */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                <span>Score Trends</span>
                                            </h3>
                                            <div className="space-y-4">
                                                {[].map((record, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                                        <div className="flex items-center space-x-4">
                                                            <div className={`w-10 h-10 bg-${record.color}-100 rounded-lg flex items-center justify-center`}>
                                                                <span className={`font-bold text-${record.color}-600`}>{record.assessment.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{record.assessment}</h4>
                                                                <p className="text-sm text-slate-500">{record.date}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-6">
                                                            <div className="text-right">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-lg font-bold text-slate-800">{record.score}</span>
                                                                    <span className={`text-sm ${record.score < record.prevScore ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {record.score < record.prevScore ? '↓' : '↑'} {Math.abs(record.score - record.prevScore)}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${record.color}-100 text-${record.color}-700`}>
                                                                    {record.severity}
                                                                </span>
                                                            </div>
                                                            <button className="text-primary-600 hover:text-primary-700">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Search and Filter */}
                                        <div className="flex items-center justify-between">
                                            <div className="relative flex-1 max-w-md">
                                                <input
                                                    type="text"
                                                    placeholder="Search past notes..."
                                                    className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                                                />
                                                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <select className="px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none text-sm">
                                                    <option>All Types</option>
                                                    <option>Follow-up</option>
                                                    <option>Initial</option>
                                                    <option>Crisis</option>
                                                </select>
                                                <select className="px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none text-sm">
                                                    <option>Last 30 days</option>
                                                    <option>Last 90 days</option>
                                                    <option>Last 6 months</option>
                                                    <option>All time</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        <div className="relative">
                                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                                            <div className="space-y-6">
                                                {[]
                                                    .map((session, index) => (
                                                        <div key={index} className="relative pl-16">
                                                            <div className={`absolute left-4 w-5 h-5 rounded-full border-4 border-white ${session.type === 'Crisis' ? 'bg-red-500' : session.type === 'Initial' ? 'bg-purple-500' : 'bg-primary-500'}`}></div>
                                                            <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div>
                                                                        <div className="flex items-center space-x-3 mb-1">
                                                                            <span className="font-bold text-slate-800">{session.date}</span>
                                                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${session.type === 'Crisis' ? 'bg-red-100 text-red-700' : session.type === 'Initial' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                {session.type}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-sm text-slate-500">{session.duration}</span>
                                                                    </div>
                                                                    <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                                                                        View Full Note
                                                                    </button>
                                                                </div>
                                                                <p className="text-slate-600 mb-4 leading-relaxed">{session.summary}</p>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {session.topics.map((topic, i) => (
                                                                            <span key={i} className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                                                                                {topic}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${session.mood === 'Positive' ? 'bg-green-100 text-green-700' : session.mood === 'Distressed' ? 'bg-red-100 text-red-700' : session.mood === 'Anxious' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                        Mood: {session.mood}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Load More */}
                                        <div className="text-center">
                                            <button className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                                                Load More Sessions
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'export' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Export Format Selection */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>Export Format</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {[
                                                    { format: 'PDF', color: 'text-red-500 bg-red-50', description: 'Professional clinical report format', recommended: true },
                                                    { format: 'Word', color: 'text-blue-500 bg-blue-50', description: 'Editable document format (.docx)', recommended: false },
                                                    { format: 'CSV', color: 'text-green-500 bg-green-50', description: 'Data export for analysis', recommended: false }
                                                ].map((option, index) => (
                                                    <button key={index} className={`relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${option.recommended ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        {option.recommended && (
                                                            <span className="absolute -top-2 right-4 text-xs font-semibold px-2 py-0.5 bg-primary-600 text-white rounded-full">
                                                                Recommended
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

                                        {/* Content Selection */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📋</span>
                                                <span>Include in Export</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { label: 'Session Notes', checked: true },
                                                    { label: 'AI-Generated Insights', checked: true },
                                                    { label: 'Assessment Scores', checked: true },
                                                    { label: 'Treatment Goals', checked: true },
                                                    { label: 'Session Transcript', checked: false },
                                                    { label: 'Appointment History', checked: false }
                                                ].map((item, index) => (
                                                    <label key={index} className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                                        <input type="checkbox" defaultChecked={item.checked} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                        <span className="font-medium text-slate-700">{item.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Date Range */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📅</span>
                                                <span>Date Range</span>
                                            </h3>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-600 mb-2">From</label>
                                                    <input type="date" defaultValue="2025-12-01" className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-600 mb-2">To</label>
                                                    <input type="date" defaultValue="2026-01-13" className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Privacy Options */}
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>🔒</span>
                                                <span>Privacy & Compliance</span>
                                            </h3>
                                            <div className="space-y-3">
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Include HIPAA compliance header</span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Redact personally identifiable information</span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Add digital signature and timestamp</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Export Button */}
                                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="font-semibold text-slate-800">Ready to export</p>
                                                <p className="text-sm text-slate-500">4 sessions • PDF format • 12 pages estimated</p>
                                            </div>
                                            <button className="btn-primary px-8 py-3 flex items-center space-x-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                <span>Generate Export</span>
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
                                <h3 className="text-lg font-bold text-slate-800">📋 Templates</h3>
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
        </div>
    )
}

export default SessionNotes
