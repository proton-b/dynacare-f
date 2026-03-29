import React, { useState, useRef, useCallback } from 'react'

const ImageAnnotationOverlay = ({ imageSrc, imageLabel, annotations: initialAnnotations, onSave, onClose }) => {
    const [annotations, setAnnotations] = useState(initialAnnotations || [])
    const [pendingPin, setPendingPin] = useState(null)
    const [pendingLabel, setPendingLabel] = useState('')
    const imageContainerRef = useRef(null)
    const labelInputRef = useRef(null)

    const handleImageClick = useCallback((e) => {
        if (pendingPin) return

        const rect = e.currentTarget.getBoundingClientRect()
        const xPct = ((e.clientX - rect.left) / rect.width) * 100
        const yPct = ((e.clientY - rect.top) / rect.height) * 100

        setPendingPin({ xPct, yPct })
        setPendingLabel('')

        setTimeout(() => {
            if (labelInputRef.current) labelInputRef.current.focus()
        }, 50)
    }, [pendingPin])

    const handleAddLabel = () => {
        if (!pendingLabel.trim() || !pendingPin) return

        const newAnnotation = {
            id: crypto.randomUUID(),
            xPct: pendingPin.xPct,
            yPct: pendingPin.yPct,
            label: pendingLabel.trim()
        }

        setAnnotations(prev => [...prev, newAnnotation])
        setPendingPin(null)
        setPendingLabel('')
    }

    const handleDeleteAnnotation = (id) => {
        setAnnotations(prev => prev.filter(a => a.id !== id))
    }

    const handleCancelPin = () => {
        setPendingPin(null)
        setPendingLabel('')
    }

    // Colors for numbered markers
    const markerColors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#ca8a04', '#be185d', '#15803d']

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Annotate Image
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">Click anywhere on the image to place a numbered marker</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Image with numbered pins only */}
                    <div
                        ref={imageContainerRef}
                        className="relative inline-block w-full select-none"
                        style={{ cursor: pendingPin ? 'default' : 'crosshair' }}
                    >
                        <img
                            src={imageSrc}
                            alt={imageLabel}
                            onClick={handleImageClick}
                            onDragStart={(e) => e.preventDefault()}
                            className="w-full rounded-lg"
                            style={{ display: 'block' }}
                            draggable={false}
                        />

                        {/* Numbered pin markers on the image */}
                        {annotations.map((ann, index) => (
                            <div
                                key={ann.id}
                                style={{
                                    position: 'absolute',
                                    left: `${ann.xPct}%`,
                                    top: `${ann.yPct}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    background: markerColors[index % markerColors.length],
                                    border: '2.5px solid white',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                    zIndex: 2
                                }}
                            >
                                <span style={{ color: 'white', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>{index + 1}</span>
                            </div>
                        ))}

                        {/* Pending pin (pulsing) */}
                        {pendingPin && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${pendingPin.xPct}%`,
                                    top: `${pendingPin.yPct}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    background: '#f59e0b',
                                    border: '3px solid white',
                                    boxShadow: '0 2px 8px rgba(245,158,11,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 4,
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                }}
                            >
                                <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>?</span>
                            </div>
                        )}
                    </div>

                    {/* Labels listed below the image */}
                    {annotations.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {annotations.map((ann, index) => (
                                <div key={ann.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                                    <div
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            background: markerColors[index % markerColors.length],
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{index + 1}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800 flex-1">{ann.label}</span>
                                    <button
                                        onClick={() => handleDeleteAnnotation(ann.id)}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                                        title="Remove"
                                    >
                                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Label Input (appears when pin is placed) */}
                    {pendingPin && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <input
                                ref={labelInputRef}
                                type="text"
                                value={pendingLabel}
                                onChange={(e) => setPendingLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddLabel()
                                    if (e.key === 'Escape') handleCancelPin()
                                }}
                                placeholder="Type label (e.g. Stomach, Liver...)"
                                className="flex-1 px-3 py-2 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none text-sm"
                            />
                            <button
                                onClick={handleAddLabel}
                                disabled={!pendingLabel.trim()}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                            <button
                                onClick={handleCancelPin}
                                className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-sm text-slate-500">
                        {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(annotations)}
                            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                        >
                            Save Labels
                        </button>
                    </div>
                </div>
            </div>

            {/* Pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.7; }
                }
            `}</style>
        </div>
    )
}

export default ImageAnnotationOverlay
