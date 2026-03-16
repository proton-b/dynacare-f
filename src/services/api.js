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
    uploadAudioFile: (formData) => api.post('/recordings/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
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
    getMedications: (patientId) => api.get(`/clinical/medications/${patientId}`),
    getDiagnoses: (patientId) => api.get(`/clinical/diagnoses/${patientId}`),
    getTreatmentPlans: (patientId) => api.get(`/clinical/treatment-plans/${patientId}`),
};

export const imageService = {
    getAll: () => api.get('/images'),
    upload: (formData) => api.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    update: (id, data) => api.patch(`/images/${id}`, data),
    delete: (id) => api.delete(`/images/${id}`),
};

export const settingsService = {
    get: () => api.get('/settings'),
    update: (settingsData) => api.patch('/settings', settingsData),
};

export default api;
