const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // Use Azure-assigned port

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Azure Blob Storage Configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads';
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Ensure the container exists
async function createContainerIfNotExists() {
    try {
        await containerClient.createIfNotExists({ access: 'container' });
        console.log(`✔ Azure Blob Storage Container: ${containerName} is ready.`);
    } catch (error) {
        console.error('❌ Error creating Azure Blob Storage container:', error);
    }
}
createContainerIfNotExists();

// ✅ File Upload Configuration (Using Memory Storage for Azure)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ Default Route to Check API
app.get('/', (req, res) => {
    res.send('🚀 Crime Reporting API is Running on Azure!');
});

// ✅ Crime Report Route (Uploads to Azure Blob Storage)
app.post('/report', upload.single('media'), async (req, res) => {
    console.log("🚀 Crime report received:", req.body);
    console.log("📸 Uploaded file:", req.file ? req.file.originalname : "❌ No file received!");

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded!" });
    }

    try {
        // Upload file to Azure Blob Storage
        const blobName = Date.now() + path.extname(req.file.originalname);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.upload(req.file.buffer, req.file.buffer.length);
        const fileUrl = blockBlobClient.url;

        // Save report details in JSON file
        const reportData = {
            description: req.body.description,
            location: req.body.location,
            mediaUrl: fileUrl
        };

        fs.appendFileSync('reports.json', JSON.stringify(reportData) + '\n');

        res.json({
            message: "Report submitted successfully",
            report: reportData
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// ✅ API to Fetch All Reports
app.get('/reports', async (req, res) => {
    try {
        const blobList = containerClient.listBlobsFlat();
        let files = [];

        for await (const blob of blobList) {
            files.push(blob.name);
        }

        res.json({ message: "Crime Reports Retrieved", files: files });
    } catch (error) {
        console.error('❌ Fetching error:', error);
        res.status(500).json({ error: 'Error retrieving reports' });
    }
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port} or Azure`);
});
