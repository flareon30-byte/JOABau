const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function listFields() {
    try {
        const filePath = path.join(__dirname, '..', 'dokumentation von GlasfaserPlus.pdf');
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log('--- FORM FIELDS ---');
        fields.forEach(field => {
            const type = field.constructor.name;
            const name = field.getName();
            console.log(`Name: ${name} | Type: ${type}`);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

listFields();
