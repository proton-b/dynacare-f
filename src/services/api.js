import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (userData) => api.post('/auth/register', userData),
    getProfile: () => api.get('/auth/profile'),
};

export const patientService = {
    getAll: () => api.get('/patients'),
    getById: (id) => api.get(`/patients/${id}`),
    create: (patientData) => api.post('/patients', patientData),
    update: (id, patientData) => api.put(`/patients/${id}`, patientData),
};

export const appointmentService = {
    getAll: () => api.get('/appointments'),
    getToday: () => api.get('/appointments/today'),
    getStats: () => api.get('/appointments/stats'),
    create: (appointmentData) => api.post('/appointments', appointmentData),
    update: (id, appointmentData) => api.put(`/appointments/${id}`, appointmentData),
    delete: (id) => api.delete(`/appointments/${id}`),
};

export const noteService = {
    getAll: () => api.get('/notes'),
    getById: (id) => api.get(`/notes/${id}`),
    getByPatientId: (patientId) => api.get(`/notes/patient/${patientId}`),
    create: (noteData) => api.post('/notes', noteData),
    update: (id, noteData) => api.put(`/notes/${id}`, noteData),
    getTemplates: () => api.get('/notes/templates'),
    createTemplate: (templateData) => api.post('/notes/templates', templateData),
};

export const recordingService = {
    getAll: () => api.get('/recordings'),
    getByPatientId: (patientId) => api.get('/recordings', { params: { patientId } }),
    getById: (id) => api.get(`/recordings/${id}`),
    upload: (recordingData) => api.post('/recordings/upload', recordingData),
    uploadAudioFile: (formData, onUploadProgress) => api.post('/recordings/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
    }),
    update: (id, data) => api.patch(`/recordings/${id}`, data),
    transcribeAudio: (formData) => api.post('/recordings/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    generateClinicalSummary: (data) => api.post('/recordings/clinical-summary', data),
};

export const dsm5Service = {
    getDisorders: (params) => api.get('/dsm5/disorders', { params }),
    aiSearch: (query) => api.get('/dsm5/ai-search', { params: { query } }),
    getDisorderByCode: (code) => api.get(`/dsm5/disorders/${code}`),
    getBookmarks: () => api.get('/dsm5/bookmarks'),
    toggleBookmark: (disorderId) => api.post('/dsm5/bookmarks', { disorder_id: disorderId }),
};

export const analyticsService = {
    getStats: (range) => api.get('/analytics/stats', { params: { range } }),
};

export const activityService = {
    getLogs: () => api.get('/activity'),
};

export const aiService = {
    getSymptomReport: (transcript) => api.post('/ai/symptom-report', { transcript }),
    analyzeSession: (transcript) => api.post('/ai/analyze-session', { transcript }),
};

export const clinicalService = {
    getHistory: (patientId) => api.get(`/clinical/history/${patientId}`),
    addHistory: (patientId, data) => api.post(`/clinical/history/${patientId}`, data),
    updateHistory: (historyId, data) => api.put(`/clinical/history/${historyId}`, data),
    deleteHistory: (historyId) => api.delete(`/clinical/history/${historyId}`),
    getMedications: (patientId) => api.get(`/clinical/medications/${patientId}`),
    addMedication: (patientId, data) => api.post(`/clinical/medications/${patientId}`, data),
    updateMedication: (id, data) => api.put(`/clinical/medications/${id}`, data),
    deleteMedication: (id) => api.delete(`/clinical/medications/${id}`),
    getDiagnoses: (patientId) => api.get(`/clinical/diagnoses/${patientId}`),
    addDiagnosis: (patientId, data) => api.post(`/clinical/diagnoses/${patientId}`, data),
    updateDiagnosis: (id, data) => api.put(`/clinical/diagnoses/${id}`, data),
    deleteDiagnosis: (id) => api.delete(`/clinical/diagnoses/${id}`),
    getTreatmentPlans: (patientId) => api.get(`/clinical/treatment-plans/${patientId}`),
    addTreatmentPlan: (patientId, data) => api.post(`/clinical/treatment-plans/${patientId}`, data),
    updateTreatmentPlan: (id, data) => api.put(`/clinical/treatment-plans/${id}`, data),
    deleteTreatmentPlan: (id) => api.delete(`/clinical/treatment-plans/${id}`),
};

export const sessionService = {
    create: (data) => api.post('/sessions', data),
    getById: (id) => api.get(`/sessions/${id}`),
    getByPatientId: (patientId) => api.get(`/sessions/patient/${patientId}`),
    update: (id, data) => api.patch(`/sessions/${id}`, data),
};

export const assessmentService = {
    createToken: (data) => api.post('/assessments/token', data),
    getResponses: (patientId, type) => api.get(`/assessments/responses/${patientId}`, { params: type ? { type } : {} }),
    // Public (no auth) - use raw axios
    validateToken: (token) => axios.get(`${API_URL}/assessments/public/${token}`),
    submitResponse: (token, data) => axios.post(`${API_URL}/assessments/public/${token}/submit`, data),
};

export const imageService = {
    getAll: () => api.get('/images'),
    upload: (formData) => api.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    update: (id, data) => api.patch(`/images/${id}`, data),
    delete: (id) => api.delete(`/images/${id}`),
};

export const journalService = {
    getMyJournals: () => api.get('/journals'),
    getAllJournals: () => api.get('/journals/all'),
};

export const settingsService = {
    get: () => api.get('/settings'),
    update: (settingsData) => api.patch('/settings', settingsData),
};

// Separate axios instance for admin (uses adminToken)
const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

adminApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const adminService = {
    login: (email, password) => adminApi.post('/admin/login', { email, password }),
    getStats: () => adminApi.get('/admin/stats'),
    getDoctors: () => adminApi.get('/admin/doctors'),
    getPatients: () => adminApi.get('/admin/patients'),
    getDoctorPatientCounts: () => adminApi.get('/admin/doctor-patient-counts'),
    createDoctor: (doctorData) => adminApi.post('/admin/create-doctor', doctorData),
    createAdmin: (adminData) => adminApi.post('/admin/create-admin', adminData),
    updateDoctorPassword: (id, password) => adminApi.patch(`/admin/doctor/${id}/password`, { password }),
    getJournals: () => adminApi.get('/admin/journals'),
    getJournalAssignments: () => adminApi.get('/admin/journal-assignments'),
    assignJournal: (userId, journalId) => adminApi.post('/admin/assign-journal', { user_id: userId, journal_id: journalId }),
    revokeJournal: (userId, journalId) => adminApi.post('/admin/revoke-journal', { user_id: userId, journal_id: journalId }),
};

export default api;
