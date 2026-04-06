import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { patientService, recordingService, journalService, sessionService } from '../services/api'
import { exportClinicalSummaryToPDF } from '../utils/pdfExport'

const SessionRecording = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedPatient, setSelectedPatient] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordings, setRecordings] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // New states for live transcription
  const [transcript, setTranscript] = useState([])
  const [detectedSymptoms, setDetectedSymptoms] = useState([])
  const [isTranscribing, setIsTranscribing] = useState(false)

  // Clinical summary states
  const [clinicalSummary, setClinicalSummary] = useState(null)
  const [harrisonSummary, setHarrisonSummary] = useState(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [activeReportTab, setActiveReportTab] = useState('dsm5')

  // Mode: 'record' or 'upload'
  const [mode, setMode] = useState('record')

  // Upload states
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDuration, setUploadDuration] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStep, setUploadStep] = useState('') // 'uploading' | 'transcribing' | 'summarizing'
  const fileInputRef = useRef(null)

  // Journal selection
  const [availableJournals, setAvailableJournals] = useState([])
  const [selectedJournals, setSelectedJournals] = useState([])
  const [journalDropdownOpen, setJournalDropdownOpen] = useState(false)
  const journalDropdownRef = useRef(null)

  // Session tracking
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [currentRecordingId, setCurrentRecordingId] = useState(null)

  // Language selection
  const [selectedLang, setSelectedLang] = useState('en-IN')
  const supportedLanguages = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
    { code: 'bn-IN', label: 'Bengali (বাংলা)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
    { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
    { code: 'mr-IN', label: 'Marathi (मराठी)' },
    { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { code: 'ur-IN', label: 'Urdu (اردو)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'ar-SA', label: 'Arabic (العربية)' },
    { code: 'fr-HT', label: 'Creole (Kreyòl Ayisyen)', whisperOnly: true, whisperCode: 'ht' },
  ]

  const getSelectedLangConfig = () => supportedLanguages.find(l => l.code === selectedLang) || supportedLanguages[0]

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (location.state && location.state.patientId) {
      setSelectedPatient(location.state.patientId);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, recordingsRes, journalsRes] = await Promise.all([
          patientService.getAll(),
          recordingService.getAll(),
          journalService.getMyJournals()
        ]);
        setPatients(patientsRes.data);
        setRecordings(recordingsRes.data);
        setAvailableJournals(journalsRes.data || []);
      } catch (err) {
        console.error("Error fetching recording data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (journalDropdownRef.current && !journalDropdownRef.current.contains(event.target)) {
        setJournalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPatients = patients.filter(patient =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id?.toString().includes(searchTerm) ||
    (patient.case_id && patient.case_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSelectedPatientName = () => {
    const patient = patients.find(p => p.id.toString() === selectedPatient.toString());
    return patient ? patient.full_name : '';
  };

  // Timer effect
  useEffect(() => {
    let interval
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording, isPaused])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Symptom detection keywords (English + Hindi)
  const symptomKeywords = [
    'anxiety', 'anxious', 'worried', 'panic', 'fear', 'nervous',
    'depressed', 'sad', 'hopeless', 'worthless', 'suicide', 'suicidal',
    'insomnia', 'sleep', 'nightmare', 'tired', 'fatigue',
    'anger', 'irritable', 'frustrated', 'rage',
    'hallucination', 'voices', 'paranoid', 'delusional',
    'trauma', 'flashback', 'ptsd', 'abuse',
    'eating', 'weight', 'appetite', 'binge', 'purge',
    'substance', 'alcohol', 'drug', 'addiction', 'withdrawal',
    // Hindi symptom keywords
    'चिंता', 'घबराहट', 'डर', 'भय', 'बेचैनी', 'तनाव',
    'उदास', 'उदासी', 'निराशा', 'अवसाद', 'आत्महत्या',
    'नींद', 'अनिद्रा', 'थकान', 'बुरे सपने',
    'गुस्सा', 'क्रोध', 'चिड़चिड़ापन',
    'भ्रम', 'आवाज़ें', 'मतिभ्रम', 'संदेह',
    'आघात', 'दुर्व्यवहार', 'शराब', 'नशा', 'लत',
    'खाना', 'वजन', 'भूख'
  ]

  const detectSymptoms = (text) => {
    const lowerText = text.toLowerCase()
    const detected = []

    symptomKeywords.forEach(keyword => {
      if (lowerText.includes(keyword) && !detectedSymptoms.includes(keyword)) {
        detected.push(keyword)
      }
    })

    if (detected.length > 0) {
      setDetectedSymptoms(prev => [...new Set([...prev, ...detected])])
    }
  }

  const getSelectedLangLabel = () => {
    return supportedLanguages.find(l => l.code === selectedLang)?.label || selectedLang
  }

  const handleStartRecording = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first')
      return
    }

    try {
      // Start audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("Recording stopped. Audio URL:", audioUrl);
      };

      mediaRecorderRef.current.start();

      const langConfig = getSelectedLangConfig();

      // For whisperOnly languages (e.g. Creole), skip Web Speech API — transcription
      // will happen via OpenAI Whisper after recording stops
      if (langConfig.whisperOnly) {
        setIsTranscribing(false);
        console.log(`Language "${langConfig.label}" uses Whisper — live transcription disabled, will transcribe after recording stops.`);
      } else if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        // Start Web Speech API for live transcription in the selected language
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = selectedLang;

        recognitionRef.current.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptSegment = result[0].transcript;
            if (result.isFinal) {
              detectSymptoms(transcriptSegment);
              setTranscript(prev => [...prev, {
                text: transcriptSegment.trim(),
                timestamp: new Date().toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Kolkata'
                }),
                type: 'final'
              }]);
            }
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        // Auto-restart on end to keep continuous listening alive
        recognitionRef.current.onend = () => {
          if (isRecording && !isPaused && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (e) { }
          }
        };

        recognitionRef.current.start();
        setIsTranscribing(true);
      }

      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      setTranscript([])
      setDetectedSymptoms([])
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  }

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsTranscribing(true);
        }
      } else {
        mediaRecorderRef.current.pause();
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          setIsTranscribing(false);
        }
      }
      setIsPaused(!isPaused)
    }
  }

  const toggleJournal = (journalId) => {
    setSelectedJournals(prev =>
      prev.includes(journalId) ? prev.filter(id => id !== journalId) : [...prev, journalId]
    )
  }

  const getSelectedJournalNames = () => {
    return availableJournals.filter(j => selectedJournals.includes(j.id)).map(j => j.name)
  }

  const handleStopRecording = async () => {
    console.log('Stop recording button clicked');

    const stopConfirm = window.confirm("Do you want to stop and save this recording?");
    if (!stopConfirm) {
      console.log('User cancelled stop recording');
      return;
    }

    try {
      console.log('Step 1: Stopping media recorder and recognition...');

      // Wait for the MediaRecorder to produce the final audio blob
      const audioBlob = await new Promise((resolve) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            resolve(blob);
          };
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        } else {
          // Already stopped — build blob from whatever chunks we have
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          resolve(blob);
        }
      });

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn('Speech recognition already stopped:', err);
        }
        setIsTranscribing(false);
      }

      setIsRecording(false)
      setIsPaused(false)

      const capturedRecordingTime = recordingTime;
      let transcriptText = (transcript || []).map(t => t?.text || '').join(' ');
      const langConfig = getSelectedLangConfig();

      console.log('Step 2: Creating session...');
      const sessionRes = await sessionService.create({ patient_id: selectedPatient });
      const sessionId = sessionRes.data.id;
      setCurrentSessionId(sessionId);

      console.log('Step 3: Uploading audio file to S3...');
      const formData = new FormData();
      formData.append('audio', audioBlob, `session_${sessionId}_${Date.now()}.webm`);
      formData.append('patient_id', selectedPatient);
      formData.append('duration', formatTime(capturedRecordingTime));
      formData.append('session_id', sessionId);
      formData.append('notes', transcriptText);

      const response = await recordingService.uploadAudioFile(formData);

      if (response.data) {
        setRecordings(prev => [response.data, ...prev]);
        setCurrentRecordingId(response.data.id);
      }
      setRecordingTime(0);

      // For whisperOnly languages (e.g. Creole), transcribe via OpenAI Whisper after upload
      if (langConfig.whisperOnly && audioBlob.size > 0) {
        console.log(`Step 3b: Transcribing with Whisper in ${langConfig.label} (${langConfig.whisperCode})...`);
        setTranscript([{ text: `Transcribing in ${langConfig.label} via AI...`, timestamp: '', type: 'final' }]);
        try {
          const whisperForm = new FormData();
          whisperForm.append('audio', audioBlob, `whisper_${sessionId}.webm`);
          whisperForm.append('language', langConfig.whisperCode);
          const whisperRes = await recordingService.transcribeAudio(whisperForm);
          if (whisperRes.data?.success && whisperRes.data.transcript) {
            transcriptText = whisperRes.data.transcript;
            setTranscript([{ text: transcriptText, timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }), type: 'final' }]);
          }
        } catch (whisperErr) {
          console.error('Whisper transcription failed:', whisperErr);
        }
      }

      // Update transcript on the recording
      if (response.data && transcriptText) {
        await recordingService.update(response.data.id, { transcript: transcriptText });
      }

      console.log('Step 4: Checking transcript for summary generation...');
      if (transcriptText && transcriptText.trim().length > 0) {
        setGeneratingSummary(true);
        try {
          console.log('Step 5: Requesting clinical summary...');
          const summaryResponse = await recordingService.generateClinicalSummary({
            transcript: transcriptText,
            patient_id: selectedPatient,
            duration: formatTime(capturedRecordingTime),
            journals: getSelectedJournalNames()
          });

          console.log('Step 6: Processing summary response:', summaryResponse.data);
          if (summaryResponse.data && summaryResponse.data.success) {
            setClinicalSummary(summaryResponse.data.summary || null);
            setHarrisonSummary(summaryResponse.data.harrisonSummary || null);
            setActiveReportTab(summaryResponse.data.summary ? 'dsm5' : 'harrison');
            setShowSummaryModal(true);
          } else {
            throw new Error('Summary generation failed: ' + (summaryResponse.data?.message || 'Unknown error'));
          }
        } catch (summaryError) {
          console.error('Error generating clinical summary:', summaryError);
          alert("Recording saved, but AI summary could not be generated: " + summaryError.message);
        } finally {
          setGeneratingSummary(false);
        }
      } else {
        console.log('No transcript found, skipping summary.');
        alert("Recording saved successfully! (No transcript to analyze)");
      }
    } catch (error) {
      console.error("CRITICAL error in handleStopRecording:", error);
      alert(`Failed to save recording: ${error.message}`);
      setIsRecording(false);
      setIsPaused(false);
      setIsTranscribing(false);
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadFile(file)
    setUploadError('')
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleUploadAudio = async () => {
    if (!selectedPatient) {
      setUploadError('Please select a patient first')
      return
    }
    if (!uploadFile) {
      setUploadError('Please select an audio file')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadProgress(0)
    setUploadStep('uploading')

    let recordingId = null
    let sessionId = null

    try {
      // Step 0: Create session
      const sessionRes = await sessionService.create({ patient_id: selectedPatient })
      sessionId = sessionRes.data.id
      setCurrentSessionId(sessionId)

      // Step 1: Upload the audio file with progress tracking
      const formData = new FormData()
      formData.append('audio', uploadFile)
      formData.append('patient_id', selectedPatient)
      formData.append('session_id', sessionId)
      if (uploadDuration) formData.append('duration', uploadDuration)
      if (uploadNotes) formData.append('notes', uploadNotes)

      const response = await recordingService.uploadAudioFile(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(percent)
      })

      if (response.data) {
        recordingId = response.data.id
        setCurrentRecordingId(recordingId)
        setRecordings(prev => [response.data, ...prev])
      }

      // Step 2: Transcribe the audio file using Whisper if no notes provided
      setUploadStep('transcribing')
      setUploadProgress(0)
      let transcriptText = uploadNotes ? uploadNotes.trim() : ''

      if (!transcriptText) {
        try {
          setUploadError('')
          const transcribeForm = new FormData()
          transcribeForm.append('audio', uploadFile)

          const transcribeResponse = await recordingService.transcribeAudio(transcribeForm)

          if (transcribeResponse.data && transcribeResponse.data.success) {
            transcriptText = transcribeResponse.data.transcript
          } else {
            throw new Error(transcribeResponse.data?.message || 'Transcription failed')
          }
        } catch (transcribeError) {
          console.error('Error transcribing audio:', transcribeError)
          alert('Audio uploaded successfully, but transcription failed: ' + transcribeError.message)
        }
      }

      // Save transcript to the recording in the database
      if (recordingId && transcriptText.length > 0) {
        try {
          await recordingService.update(recordingId, { transcript: transcriptText })
        } catch (updateErr) {
          console.error('Error saving transcript to recording:', updateErr)
        }
      }

      // Detect symptoms from the transcript
      if (transcriptText.length > 0) {
        detectSymptoms(transcriptText)
      }

      // Step 3: Generate clinical summary from transcript
      if (transcriptText.length > 0) {
        setUploadStep('summarizing')
        setGeneratingSummary(true)
        try {
          const summaryResponse = await recordingService.generateClinicalSummary({
            transcript: transcriptText,
            patient_id: selectedPatient,
            duration: uploadDuration || 'N/A',
            journals: getSelectedJournalNames()
          })

          if (summaryResponse.data && summaryResponse.data.success) {
            setClinicalSummary(summaryResponse.data.summary || null)
            setHarrisonSummary(summaryResponse.data.harrisonSummary || null)
            setActiveReportTab(summaryResponse.data.summary ? 'dsm5' : 'harrison')

            // Save summary to the recording in the database
            if (recordingId) {
              try {
                const combinedSummary = {
                  ...(summaryResponse.data.summary && { dsm5: summaryResponse.data.summary }),
                  ...(summaryResponse.data.harrisonSummary && { harrison: summaryResponse.data.harrisonSummary })
                }
                await recordingService.update(recordingId, { summary: combinedSummary })
                setRecordings(prev => prev.map(r =>
                  r.id === recordingId
                    ? { ...r, transcript: transcriptText, summary: JSON.stringify(combinedSummary) }
                    : r
                ))
              } catch (updateErr) {
                console.error('Error saving summary to recording:', updateErr)
              }
            }

            setShowSummaryModal(true)
          } else {
            throw new Error('Summary generation failed: ' + (summaryResponse.data?.message || 'Unknown error'))
          }
        } catch (summaryError) {
          console.error('Error generating clinical summary:', summaryError)
          alert('Audio uploaded successfully, but AI summary could not be generated: ' + summaryError.message)
        } finally {
          setGeneratingSummary(false)
        }
      }

      // Store transcript for the "Create Session Notes" button in the modal
      setTranscript([{
        text: transcriptText,
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: true, timeZone: 'Asia/Kolkata'
        }),
        type: 'final'
      }])

      setUploadFile(null)
      setUploadDuration('')
      setUploadNotes('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Error uploading audio file:', err)
      setUploadError(err.response?.data?.message || 'Failed to upload audio file')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadStep('')
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 font-display">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium font-sans">Initializing recording studio...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 font-display">Session Recording</h1>
            <p className="text-slate-500 mt-1">Record or upload sessions with live DSM-5 cross-referencing</p>
          </div>
          {/* <div className="flex items-center space-x-3"> */}
          {/*   <button className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2"> */}
          {/*     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> */}
          {/*       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> */}
          {/*       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> */}
          {/*     </svg> */}
          {/*     <span>Settings</span> */}
          {/*   </button> */}
          {/* </div> */}
        </div>
      </header>

      {/* Mode Tabs */}
      <div className="px-8 pt-6">
        <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => !isRecording && setMode('record')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 ${mode === 'record'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              } ${isRecording ? 'cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Record Session</span>
          </button>
          <button
            onClick={() => !isRecording && setMode('upload')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 ${mode === 'upload'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              } ${isRecording ? 'cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Audio</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area - Left (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Selection Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Select Patient</h3>
              <p className="text-sm text-slate-500 mb-4">Choose a patient before starting the session recording</p>

              <div className="relative" ref={dropdownRef}>
                <div
                  className={`flex items-center w-full p-4 pr-10 border-2 rounded-xl bg-white transition-all cursor-text ${isRecording ? 'opacity-75 cursor-not-allowed' : 'hover:border-slate-300 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-100'} ${isDropdownOpen ? 'border-primary-500 ring-4 ring-primary-100' : 'border-slate-200'}`}
                  onClick={() => !isRecording && setIsDropdownOpen(true)}
                >
                  <input
                    type="text"
                    placeholder={selectedPatient ? getSelectedPatientName() : "Search for a patient..."}
                    value={isDropdownOpen ? searchTerm : (selectedPatient ? getSelectedPatientName() : searchTerm)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-transparent outline-none text-slate-700 font-medium placeholder:text-slate-400"
                    disabled={isRecording}
                  />
                  <svg
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 transition-transform cursor-pointer ${isDropdownOpen ? 'rotate-180 text-primary-500' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    onClick={(e) => {
                      e.stopPropagation();
                      !isRecording && setIsDropdownOpen(!isDropdownOpen);
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isDropdownOpen && !isRecording && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredPatients.length > 0 ? (
                      <div className="p-2">
                        {filteredPatients.map(patient => (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatient(patient.id);
                              setSearchTerm('');
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${selectedPatient.toString() === patient.id.toString()
                              ? 'bg-primary-50 border-primary-100 border text-primary-700'
                              : 'hover:bg-slate-50 text-slate-700'
                              }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{patient.full_name}</span>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{patient.case_id || 'ID-#' + patient.id}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${patient.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {patient.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="text-4xl mb-2 text-slate-300">🕵️</div>
                        <p className="text-slate-500 font-medium">No patients found</p>
                        <p className="text-xs text-slate-400 mt-1">Try a different name or ID</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Language Selection */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">Transcription Language</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  disabled={isRecording}
                  className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all text-sm font-medium text-slate-700 ${isRecording ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'bg-white'}`}
                >
                  {supportedLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">Select the language being spoken in the session</p>
              </div>

              {/* Journal Selection */}
              {availableJournals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Reference Journals</label>
                  <p className="text-xs text-slate-400 mb-3">Select journals to reference in the clinical report</p>
                  <div className="relative" ref={journalDropdownRef}>
                    <button
                      type="button"
                      onClick={() => !isRecording && setJournalDropdownOpen(!journalDropdownOpen)}
                      disabled={isRecording}
                      className={`w-full px-4 py-3 border-2 rounded-xl text-left text-sm font-medium transition-all flex items-center justify-between ${isRecording ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' : journalDropdownOpen ? 'border-primary-500 ring-4 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className={selectedJournals.length > 0 ? 'text-slate-700' : 'text-slate-400'}>
                        {selectedJournals.length > 0
                          ? `${selectedJournals.length} journal${selectedJournals.length > 1 ? 's' : ''} selected`
                          : 'Select journals (optional)'}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${journalDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {journalDropdownOpen && !isRecording && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {availableJournals.map(journal => {
                            const isSelected = selectedJournals.includes(journal.id)
                            return (
                              <button
                                key={journal.id}
                                onClick={() => toggleJournal(journal.id)}
                                className={`w-full text-left p-3 rounded-lg flex items-center space-x-3 transition-colors ${isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'}`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{journal.name}</p>
                                  {journal.target_audience && (
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{journal.target_audience}</p>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected journal chips */}
                  {selectedJournals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {availableJournals.filter(j => selectedJournals.includes(j.id)).map(journal => (
                        <span
                          key={journal.id}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-lg border border-primary-200"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="truncate max-w-[150px]">{journal.name}</span>
                          <button
                            onClick={() => toggleJournal(journal.id)}
                            className="hover:text-red-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload Audio Interface */}
            {mode === 'upload' && (
              <div className="bg-white rounded-xl border border-slate-200 p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Upload Audio File</h3>
                <p className="text-sm text-slate-500 mb-6">Upload a pre-recorded session audio file for archiving</p>

                {uploadError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                    {uploadError}
                  </div>
                )}

                {/* Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${uploadFile
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
                    }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files[0]
                    if (file && file.type.startsWith('audio/')) {
                      setUploadFile(file)
                      setUploadError('')
                    } else {
                      setUploadError('Please drop an audio file')
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {uploadFile ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{uploadFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatFileSize(uploadFile.size)} &middot; {uploadFile.type || 'audio'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUploadFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Click to browse or drag & drop</p>
                        <p className="text-xs text-slate-400 mt-1">MP3, WAV, M4A, OGG, WebM, AAC, FLAC (max 100MB)</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Fields */}
                <div className="space-y-4 mt-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Duration (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 45:00 or 2700"
                      value={uploadDuration}
                      onChange={(e) => setUploadDuration(e.target.value)}
                      className="w-full md:w-1/2 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Session Transcript / Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea
                      placeholder="Optionally paste notes here, or leave empty to auto-transcribe the audio using AI..."
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all text-sm resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">If left empty, the audio will be automatically transcribed using AI (Whisper). You can also paste notes to use instead.</p>
                  </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    {/* Step Indicators */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className={`flex items-center space-x-2 ${uploadStep === 'uploading' ? 'text-primary-600' : uploadStep === 'transcribing' || uploadStep === 'summarizing' ? 'text-green-600' : 'text-slate-400'}`}>
                        {uploadStep === 'uploading' ? (
                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (uploadStep === 'transcribing' || uploadStep === 'summarizing') ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                        )}
                        <span>Upload</span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200 mx-3"></div>
                      <div className={`flex items-center space-x-2 ${uploadStep === 'transcribing' ? 'text-primary-600' : uploadStep === 'summarizing' ? 'text-green-600' : 'text-slate-400'}`}>
                        {uploadStep === 'transcribing' ? (
                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : uploadStep === 'summarizing' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                        )}
                        <span>Transcribe</span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200 mx-3"></div>
                      <div className={`flex items-center space-x-2 ${uploadStep === 'summarizing' ? 'text-primary-600' : 'text-slate-400'}`}>
                        {uploadStep === 'summarizing' ? (
                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                        )}
                        <span>AI Summary</span>
                      </div>
                    </div>

                    {/* Progress Bar (shown during file upload step) */}
                    {uploadStep === 'uploading' && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                          <span>Uploading {uploadFile?.name}</span>
                          <span className="font-bold text-primary-600">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {uploadStep === 'transcribing' && (
                      <p className="text-sm text-slate-500">Transcribing audio with AI (Whisper)...</p>
                    )}
                    {uploadStep === 'summarizing' && (
                      <p className="text-sm text-slate-500">Generating clinical summary...</p>
                    )}
                  </div>
                )}

                {/* Upload Button */}
                {!uploading && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleUploadAudio}
                      disabled={!uploadFile || !selectedPatient}
                      className="px-8 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Upload Audio</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Recording Interface Card */}
            {mode === 'record' && <div className="bg-white rounded-xl border border-slate-200 p-12">
              <div className="flex flex-col items-center justify-center space-y-8">
                {/* Microphone Icon */}
                <div className={`relative ${isRecording && !isPaused ? 'animate-pulse' : ''}`}>
                  <div className={`w-40 h-40 rounded-full flex items-center justify-center ${isRecording
                    ? isPaused
                      ? 'bg-yellow-100'
                      : 'bg-red-100'
                    : 'bg-slate-100'
                    }`}>
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isRecording
                      ? isPaused
                        ? 'bg-yellow-500'
                        : 'bg-red-500 shadow-lg shadow-red-300'
                      : 'bg-teal-500'
                      }`}>
                      <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </div>
                  {isRecording && !isPaused && (
                    <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75"></div>
                  )}
                </div>

                {/* Timer */}
                <div className="text-center">
                  <div className="text-5xl font-bold text-slate-800 font-mono mb-2 tracking-tighter">
                    {formatTime(recordingTime)}
                  </div>
                  <p className="text-slate-500 font-medium">
                    {isRecording
                      ? isPaused
                        ? 'Recording paused'
                        : '🔴 Recording in progress...'
                      : 'Ready to start clinical session'
                    }
                  </p>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center space-x-4">
                  {!isRecording ? (
                    <button
                      onClick={handleStartRecording}
                      className="btn-primary px-10 py-5 text-xl flex items-center space-x-3 rounded-2xl shadow-xl shadow-primary-200"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePauseRecording}
                        className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-yellow-100 flex items-center space-x-3"
                      >
                        {isPaused ? (
                          <>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Resume Session</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Pause Session</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleStopRecording}
                        className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-100 flex items-center space-x-3"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        <span>End Session</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>}

            {/* AI Live Insights (shown during recording) */}
            {isRecording && !isPaused && (
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100 p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <span className="text-white text-2xl">🧠</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-3 font-display">Live Clinical Intelligence</h3>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                      The neural engine is actively listening for clinical keywords, behavioral patterns, and DSM-5 diagnostic indicators...
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 p-4 bg-white/60 rounded-xl border border-white">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                        <span className="text-sm font-semibold text-slate-700">Acoustic Logic Active</span>
                      </div>
                      <div className="flex items-center space-x-3 p-4 bg-white/60 rounded-xl border border-white">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
                        <span className="text-sm font-semibold text-slate-700">DSM-5 Correlation Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Transcription Box */}
            {isRecording && (
              <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xl">
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isTranscribing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <h3 className="text-lg font-bold text-white font-display">Live Transcription</h3>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs font-medium text-slate-300">
                      {isTranscribing ? '🎤 Listening...' : '⏸️ Paused'}
                    </span>
                    <span className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full">
                      {transcript.length} segments
                    </span>
                  </div>
                </div>

                {/* Transcript Display */}
                <div className="p-6 bg-slate-50">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-xl border border-slate-200 p-4 h-96 overflow-y-auto">
                        {transcript.length > 0 ? (
                          <div className="space-y-4">
                            {transcript.map((entry, index) => {
                              const hasSymptom = symptomKeywords.some(keyword =>
                                entry.text.toLowerCase().includes(keyword)
                              );

                              return (
                                <div
                                  key={index}
                                  className={`p-4 rounded-lg border-l-4 ${hasSymptom
                                    ? 'bg-yellow-50 border-yellow-500'
                                    : 'bg-slate-50 border-slate-300'
                                    }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      {entry.timestamp}
                                    </span>
                                    {hasSymptom && (
                                      <span className="px-2 py-0.5 bg-yellow-500 text-white text-[10px] font-bold rounded-full">
                                        ⚠️ SYMPTOM DETECTED
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-700 leading-relaxed">
                                    {entry.text}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-slate-400 font-medium">Waiting for speech...</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center space-x-2">
                          <span>🔍</span>
                          <span>Detected Keywords</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {detectedSymptoms.map((symptom, index) => (
                            <span key={index} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full border border-yellow-200">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Session Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Duration</span>
                  <span className="text-sm font-bold text-slate-800">{formatTime(recordingTime)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Symptom Flags</span>
                  <span className="text-sm font-bold text-yellow-600">{detectedSymptoms.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Archives</h3>
              <div className="space-y-4">
                {recordings.slice(0, 5).map(rec => (
                  <div key={rec.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm font-bold text-slate-800 mb-1">{rec.patient_name || 'Anonymous'}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                      <span>{rec.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Summary Modal */}
      {showSummaryModal && (clinicalSummary || harrisonSummary) && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl mx-auto my-8 shadow-2xl flex flex-col max-h-[calc(100vh-4rem)]">
            <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">AI Clinical Summary</h2>
              <button onClick={() => setShowSummaryModal(false)} className="text-white hover:text-indigo-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Report Tab Switcher */}
            <div className="px-8 pt-6 pb-2 flex space-x-2 flex-shrink-0 border-b border-slate-100">
              {clinicalSummary && (
                <button
                  onClick={() => setActiveReportTab('dsm5')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    activeReportTab === 'dsm5'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  DSM-5 Report
                </button>
              )}
              {harrisonSummary && (
                <button
                  onClick={() => setActiveReportTab('harrison')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    activeReportTab === 'harrison'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Harrison Report
                </button>
              )}
            </div>

            <div className="p-8 space-y-8 overflow-y-auto flex-1">
              {/* DSM-5 Report */}
              {activeReportTab === 'dsm5' && (
                <>
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
                      <h4 className="text-xs font-bold text-indigo-600 uppercase mb-3">DSM-5 Indications</h4>
                      {clinicalSummary.clinicalImpression?.possibleDiagnoses?.length > 0 ? (
                        <div className="space-y-3">
                          {clinicalSummary.clinicalImpression.possibleDiagnoses.map((dx, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-indigo-50 shadow-sm">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-800 text-sm">{dx.name}</span>
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">{dx.code}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{dx.evidence}</p>
                              <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded font-medium ${
                                dx.confidence === 'High' ? 'bg-red-100 text-red-700' :
                                dx.confidence === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{dx.confidence} confidence</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm italic">No specific DSM-5 matches found.</p>
                      )}
                    </div>

                    <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-100">
                      <h4 className="text-xs font-bold text-yellow-700 uppercase mb-3">Reported Symptoms</h4>
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

                  {clinicalSummary.riskAssessment && (
                    <div className={`p-6 rounded-xl border ${
                      clinicalSummary.riskAssessment.color === 'red' ? 'bg-red-50 border-red-200' :
                      clinicalSummary.riskAssessment.color === 'yellow' ? 'bg-amber-50 border-amber-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <h4 className="text-xs font-bold uppercase mb-2" style={{ color: clinicalSummary.riskAssessment.color === 'red' ? '#dc2626' : clinicalSummary.riskAssessment.color === 'yellow' ? '#d97706' : '#16a34a' }}>
                        Risk Assessment: {clinicalSummary.riskAssessment.level}
                      </h4>
                      {clinicalSummary.riskAssessment.concerns?.length > 0 && (
                        <ul className="text-sm text-slate-700 space-y-1 mt-2">
                          {clinicalSummary.riskAssessment.concerns.map((c, i) => (
                            <li key={i} className="flex items-start space-x-2"><span>-</span><span>{c}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {clinicalSummary.treatmentPlan && (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">Treatment Plan</h4>
                      <ul className="text-sm text-slate-700 space-y-2">
                        {clinicalSummary.treatmentPlan.recommendations?.map((rec, i) => (
                          <li key={i} className="flex items-start space-x-2"><span className="text-indigo-500 font-bold">{i+1}.</span><span>{rec}</span></li>
                        ))}
                      </ul>
                      {clinicalSummary.treatmentPlan.followUp && (
                        <p className="mt-3 text-xs text-slate-500">Follow-up: {clinicalSummary.treatmentPlan.followUp}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Harrison Report */}
              {activeReportTab === 'harrison' && harrisonSummary && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                      <h4 className="text-xs font-bold text-emerald-600 uppercase mb-2">Primary Medical Concerns</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {harrisonSummary.overview?.primaryConcerns?.map((c, i) => (
                          <li key={i} className="flex items-start space-x-2"><span>-</span><span>{c}</span></li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-6 bg-teal-50 rounded-xl border border-teal-100">
                      <h4 className="text-xs font-bold text-teal-600 uppercase mb-2">Systems Involved</h4>
                      <div className="flex flex-wrap gap-2">
                        {harrisonSummary.overview?.systemsInvolved?.map((sys, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-teal-200 text-teal-700 rounded-full text-xs font-medium">
                            {sys}
                          </span>
                        ))}
                      </div>
                      {harrisonSummary.overview?.vitalSignConcerns && (
                        <p className="mt-3 text-xs text-slate-500">{harrisonSummary.overview.vitalSignConcerns}</p>
                      )}
                    </div>
                  </div>

                  {/* Possible Medical Conditions */}
                  <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                    <h4 className="text-xs font-bold text-emerald-600 uppercase mb-3">Possible Medical Conditions (Harrison's Reference)</h4>
                    {harrisonSummary.medicalFindings?.possibleConditions?.length > 0 ? (
                      <div className="space-y-3">
                        {harrisonSummary.medicalFindings.possibleConditions.map((cond, i) => (
                          <div key={i} className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-800 text-sm">{cond.condition}</span>
                              {cond.icdCode && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">{cond.icdCode}</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{cond.evidence}</p>
                            {cond.harrisonReference && (
                              <p className="text-xs text-emerald-600 mt-1 font-medium">Ref: {cond.harrisonReference}</p>
                            )}
                            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded font-medium ${
                              cond.confidence === 'High' ? 'bg-red-100 text-red-700' :
                              cond.confidence === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{cond.confidence} confidence</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm italic">No specific medical conditions identified.</p>
                    )}
                  </div>

                  {/* Reported Medical Symptoms */}
                  <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-100">
                    <h4 className="text-xs font-bold text-yellow-700 uppercase mb-3">Reported Medical Symptoms</h4>
                    <div className="flex flex-wrap gap-2">
                      {harrisonSummary.medicalFindings?.reportedSymptoms?.map((sym, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-yellow-200 text-yellow-800 rounded-full text-xs font-medium shadow-sm">
                          {sym}
                        </span>
                      ))}
                    </div>
                    {harrisonSummary.medicalFindings?.differentialDiagnosis?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-yellow-200/50">
                        <p className="text-xs font-bold text-yellow-800 mb-2">Differential Diagnosis:</p>
                        <div className="flex flex-wrap gap-2">
                          {harrisonSummary.medicalFindings.differentialDiagnosis.map((dd, i) => (
                            <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">{dd}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lab Recommendations */}
                  {harrisonSummary.labRecommendations?.suggestedTests?.length > 0 && (
                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                      <h4 className="text-xs font-bold text-blue-600 uppercase mb-3">Recommended Lab Tests</h4>
                      <div className="space-y-2">
                        {harrisonSummary.labRecommendations.suggestedTests.map((test, i) => (
                          <div key={i} className="bg-white p-3 rounded-lg border border-blue-50 shadow-sm">
                            <span className="font-semibold text-slate-800 text-sm">{test.test}</span>
                            <p className="text-xs text-slate-500 mt-0.5">{test.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Treatment Plan */}
                  {harrisonSummary.treatmentPlan && (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">Medical Treatment Plan</h4>
                      <ul className="text-sm text-slate-700 space-y-2">
                        {harrisonSummary.treatmentPlan.recommendations?.map((rec, i) => (
                          <li key={i} className="flex items-start space-x-2"><span className="text-emerald-500 font-bold">{i+1}.</span><span>{rec}</span></li>
                        ))}
                      </ul>
                      {harrisonSummary.treatmentPlan.referrals?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-xs font-bold text-slate-600 mb-1">Specialist Referrals:</p>
                          <div className="flex flex-wrap gap-2">
                            {harrisonSummary.treatmentPlan.referrals.map((ref, i) => (
                              <span key={i} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">{ref}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {harrisonSummary.treatmentPlan.followUp && (
                        <p className="mt-3 text-xs text-slate-500">Follow-up: {harrisonSummary.treatmentPlan.followUp}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="mt-8 flex items-center justify-end space-x-4">
                <button
                  onClick={() => {
                    const transcriptText = transcript.map(t => t.text).join(' ');
                    navigate('/notes', {
                      state: {
                        transcript: transcriptText,
                        summary: clinicalSummary,
                        harrisonSummary: harrisonSummary,
                        patientId: selectedPatient,
                        sessionId: currentSessionId,
                        recordingId: currentRecordingId
                      }
                    });
                  }}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center space-x-2"
                >
                  <span>Create Session Notes</span>
                </button>
                <button
                  onClick={() => {
                    const selectedPatientData = patients.find(p => p.id === parseInt(selectedPatient));
                    const patientName = selectedPatientData?.full_name || 'Patient';
                    exportClinicalSummaryToPDF(clinicalSummary, patientName, harrisonSummary);
                  }}
                  className="px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl transition-all flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <span>Export Summary</span>
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
            <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Clinical Report{selectedJournals.length !== 1 ? 's' : ''}...</h3>
            <p className="text-slate-500">
              {selectedJournals.length > 0
                ? `Analyzing transcript with ${getSelectedJournalNames().join(', ')}`
                : 'Analyzing transcript with DSM-5 & Harrison\'s references'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionRecording
