const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// CORS 활성화
app.use(cors());

// source 폴더의 PDF 파일 목록 제공
app.get('/api/pdf-list', (req, res) => {
  const sourceDir = path.join(__dirname, 'source');
  const files = fs.readdirSync(sourceDir);

  // 기출문제 PDF 파일만 필터링
  const pdfFiles = files.filter(file => {
    const fileName = file.toLowerCase();

    // PDF 파일만
    if (!fileName.endsWith('.pdf')) return false;

    // 제외할 파일들
    const excludePatterns = [
      '요점정리',
      '출제기준',
      '기호',
      '그래프',
      '기초이론',
      '개정',
    ];

    // 제외 패턴에 해당하는 파일 제외
    if (excludePatterns.some(pattern => fileName.includes(pattern))) {
      return false;
    }

    // "해설"만 있는 파일 제외 (기출문제가 없는 해설 전용)
    if (fileName.includes('해설') && !fileName.includes('회')) {
      return false;
    }

    return true;
  });

  res.json({ files: pdfFiles });
});

// 개별 PDF 파일 제공
app.get('/api/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'source', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n📡 PDF Server running at http://localhost:${PORT}`);
  console.log(`\n📂 Serving PDF files from: ${path.join(__dirname, 'source')}`);
  console.log(`\n💡 API Endpoints:`);
  console.log(`   - GET /api/pdf-list : Get list of PDF files`);
  console.log(`   - GET /api/pdf/:filename : Get specific PDF file`);
  console.log(`\n✅ Server is ready!`);
  console.log(`\n🌐 Now open your browser and go to the admin page to auto-import PDFs`);
});
