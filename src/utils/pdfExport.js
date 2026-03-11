import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportClinicalSummaryToPDF = (summary, patientName) => {
    try {
        console.log('Starting PDF export...');
        console.log('Summary data:', summary);
        console.log('Patient name:', patientName);

        const doc = new jsPDF();

        // Professional Styling Constants
        const colors = {
            primary: [30, 41, 59], // Slate-800 for header
            accent: [67, 56, 202], // Indigo-700 for highlights
            text: [51, 65, 85],    // Slate-700 for body
            lightBg: [248, 250, 252] // Slate-50
        };

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 0;

        // --- Header Section ---
        doc.setFillColor(...colors.primary);
        doc.rect(0, 0, pageWidth, 50, 'F');

        // Logo/Brand Name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.setFont(undefined, 'bold');
        doc.text('DynaCare', 20, 32);

        // Document Title
        doc.setFontSize(16);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(203, 213, 225); // Slate-300
        doc.text('Clinical Session Summary', pageWidth - 20, 32, { align: 'right' });

        yPosition = 70;

        // --- Patient Info Block ---
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 55, pageWidth - 28, 25, 3, 3, 'S');

        doc.setFontSize(10);
        doc.setTextColor(...colors.accent);
        doc.setFont(undefined, 'bold');
        doc.text('PATIENT NAME', 20, 65);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(patientName || 'Unknown', 20, 73);

        doc.setFontSize(10);
        doc.setTextColor(...colors.accent);
        doc.setFont(undefined, 'bold');
        doc.text('DATE OF SERVICE', 100, 65);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(new Date().toLocaleDateString(), 100, 73);

        yPosition = 95;

        // Helper function for Section Headers
        const addSectionHeader = (title, y) => {
            doc.setFillColor(...colors.lightBg);
            doc.rect(14, y - 6, pageWidth - 28, 10, 'F');
            doc.setFontSize(12);
            doc.setTextColor(...colors.primary);
            doc.setFont(undefined, 'bold');
            doc.text(title.toUpperCase(), 16, y);
            return y + 8;
        };

        // --- Session Overview ---
        yPosition = addSectionHeader('Session Overview', yPosition);

        autoTable(doc, {
            startY: yPosition,
            head: [['Metric', 'Value']],
            body: [
                ['Mood', summary.overview.mood],
                ['Mood Score', `${summary.overview.moodScore}/10`],
                ['Affect', summary.overview.affect],
                ['Engagement', summary.overview.engagement],
            ],
            theme: 'grid',
            headStyles: {
                fillColor: colors.primary,
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 6,
                textColor: colors.text
            },
            margin: { left: 14, right: 14 },
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- Reported Symptoms ---
        if (yPosition > pageHeight - 60) { doc.addPage(); yPosition = 20; }
        yPosition = addSectionHeader('Reported Symptoms', yPosition);

        autoTable(doc, {
            startY: yPosition,
            head: [['Symptom', 'Severity']],
            body: summary.symptoms.reported.map(symptom => [symptom, summary.symptoms.severity]),
            theme: 'striped',
            headStyles: { fillColor: colors.accent },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: 14, right: 14 },
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- Risk Assessment ---
        if (yPosition > pageHeight - 60) { doc.addPage(); yPosition = 20; }
        yPosition = addSectionHeader('Risk Assessment', yPosition);

        const riskColor = summary.riskAssessment.color === 'red' ? [220, 38, 38] :
            summary.riskAssessment.color === 'yellow' ? [234, 179, 8] : [22, 163, 74];

        autoTable(doc, {
            startY: yPosition,
            head: [['Assessment']],
            body: [
                [`Risk Level: ${summary.riskAssessment.level}`],
                ...summary.riskAssessment.concerns.map(c => [c])
            ],
            theme: 'plain',
            headStyles: { fillColor: riskColor, textColor: [255, 255, 255] },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: 14, right: 14 },
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- DSM-5 Indications ---
        if (yPosition > pageHeight - 80) { doc.addPage(); yPosition = 20; }
        yPosition = addSectionHeader('DSM-5 Indications', yPosition);

        autoTable(doc, {
            startY: yPosition,
            head: [['Code', 'Diagnosis', 'Confidence']],
            body: summary.clinicalImpression.possibleDiagnoses.map(d => [
                d.code,
                d.name,
                d.confidence
            ]),
            theme: 'grid',
            headStyles: { fillColor: colors.primary },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: 14, right: 14 },
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- Treatment Plan ---
        if (yPosition > pageHeight - 80) { doc.addPage(); yPosition = 20; }
        yPosition = addSectionHeader('Treatment Recommendations', yPosition);

        autoTable(doc, {
            startY: yPosition,
            head: [['#', 'Recommendation']],
            body: summary.treatmentPlan.recommendations.map((rec, idx) => [
                (idx + 1).toString(),
                rec
            ]),
            theme: 'striped',
            headStyles: { fillColor: colors.accent },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: 14, right: 14 },
        });
        yPosition = doc.lastAutoTable.finalY + 10;

        // Follow-up Text
        doc.setFillColor(241, 245, 249); // Slate-100
        doc.roundedRect(14, yPosition, pageWidth - 28, 12, 1, 1, 'F');
        doc.setFontSize(10);
        doc.setTextColor(...colors.text);
        doc.setFont(undefined, 'bold');
        doc.text(`Follow-up: ${summary.treatmentPlan.followUp}`, 18, yPosition + 8);
        yPosition += 25;

        // --- Next Steps ---
        if (yPosition > pageHeight - 60) { doc.addPage(); yPosition = 20; }
        yPosition = addSectionHeader('Next Steps', yPosition);

        autoTable(doc, {
            startY: yPosition,
            body: summary.nextSteps.map(step => [step]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 5, textColor: colors.text },
            margin: { left: 14, right: 14 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        // --- Footer ---
        const timestamp = new Date().toLocaleString();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(`Generated: ${timestamp}`, 14, pageHeight - 10);
        doc.text('DynaCare - HIPAA Compliant Mental Health Platform', pageWidth - 14, pageHeight - 10, { align: 'right' });

        // Save the PDF
        const filename = `Clinical_Summary_${patientName?.replace(/\s+/g, '_') || 'Patient'}_${new Date().toISOString().split('T')[0]}.pdf`;
        console.log('Saving PDF as:', filename);
        doc.save(filename);
        console.log('PDF export completed successfully!');

        // Show success message
        alert('✅ PDF exported successfully! Check your Downloads folder.');

    } catch (error) {
        console.error('ERROR exporting PDF:', error);
        console.error('Error stack:', error.stack);
        alert(`❌ Failed to export PDF: ${error.message}\n\nCheck the console for details.`);
    }
};
