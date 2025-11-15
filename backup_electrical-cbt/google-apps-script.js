/**
 * 전기기능사 CBT Google Apps Script API
 * 이 코드를 Google Sheets의 Apps Script 에디터에 붙여넣으세요
 */

// ==================== 설정 ====================
const SHEETS = {
  QUESTIONS: 'questions',
  USERS: 'users',
  RESULTS: 'results'
};

// ==================== 유틸리티 함수 ====================

/**
 * 시트 가져오기
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * 시트 데이터를 JSON 배열로 변환
 */
function sheetToJson(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length === 0) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * JSON 데이터를 시트에 쓰기
 */
function jsonToSheet(sheetName, jsonArray) {
  if (!jsonArray || jsonArray.length === 0) return;

  const sheet = getSheet(sheetName);
  const headers = Object.keys(jsonArray[0]);

  // 헤더가 없으면 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  // 데이터 추가
  jsonArray.forEach(obj => {
    const row = headers.map(header => obj[header] || '');
    sheet.appendRow(row);
  });
}

// ==================== API 엔드포인트 ====================

/**
 * HTTP OPTIONS 요청 처리 (CORS Preflight)
 */
function doOptions(e) {
  return createResponse({});
}

/**
 * HTTP GET 요청 처리
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheet = e.parameter.sheet;

    if (!action || !sheet) {
      return createResponse({ error: 'action과 sheet 파라미터가 필요합니다' }, 400);
    }

    switch(action) {
      case 'getAll':
        return handleGetAll(sheet);
      case 'getById':
        return handleGetById(sheet, e.parameter.id);
      case 'add':
        // CORS 우회를 위해 GET으로 데이터 추가 처리
        if (!e.parameter.data) {
          return createResponse({ error: 'data 파라미터가 필요합니다' }, 400);
        }
        const addData = JSON.parse(e.parameter.data);
        return handleAdd(sheet, addData);
      case 'update':
        if (!e.parameter.data) {
          return createResponse({ error: 'data 파라미터가 필요합니다' }, 400);
        }
        const updateData = JSON.parse(e.parameter.data);
        return handleUpdate(sheet, updateData);
      case 'delete':
        return handleDelete(sheet, e.parameter.id);
      case 'bulkAdd':
        if (!e.parameter.data) {
          return createResponse({ error: 'data 파라미터가 필요합니다' }, 400);
        }
        const bulkData = JSON.parse(e.parameter.data);
        return handleBulkAdd(sheet, bulkData);
      default:
        return createResponse({ error: '지원하지 않는 action입니다' }, 400);
    }
  } catch (error) {
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * HTTP POST 요청 처리
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    const sheet = e.parameter.sheet;
    const data = JSON.parse(e.postData.contents);

    if (!action || !sheet) {
      return createResponse({ error: 'action과 sheet 파라미터가 필요합니다' }, 400);
    }

    switch(action) {
      case 'add':
        return handleAdd(sheet, data);
      case 'update':
        return handleUpdate(sheet, data);
      case 'delete':
        return handleDelete(sheet, data.id);
      case 'bulkAdd':
        return handleBulkAdd(sheet, data);
      default:
        return createResponse({ error: '지원하지 않는 action입니다' }, 400);
    }
  } catch (error) {
    return createResponse({ error: error.toString() }, 500);
  }
}

// ==================== 핸들러 함수 ====================

/**
 * 전체 데이터 조회
 */
function handleGetAll(sheetName) {
  const data = sheetToJson(sheetName);
  return createResponse({ success: true, data: data });
}

/**
 * ID로 데이터 조회
 */
function handleGetById(sheetName, id) {
  const data = sheetToJson(sheetName);
  const item = data.find(row => row.id == id);

  if (!item) {
    return createResponse({ error: '데이터를 찾을 수 없습니다' }, 404);
  }

  return createResponse({ success: true, data: item });
}

/**
 * 데이터 추가
 */
function handleAdd(sheetName, data) {
  const sheet = getSheet(sheetName);

  // 헤더 확인
  if (sheet.getLastRow() === 0) {
    const headers = Object.keys(data);
    sheet.appendRow(headers);
  }

  // ID가 없거나 0이면 그대로 유지 (로컬에서 관리하므로)
  // Google Sheets에는 ID를 그대로 저장만 함
  // ID가 없으면 빈 값으로 저장 (로컬에서 나중에 부여)

  // 데이터 추가
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => data[header] || '');
  sheet.appendRow(row);

  return createResponse({ success: true, data: data });
}

/**
 * 데이터 수정
 */
function handleUpdate(sheetName, data) {
  const sheet = getSheet(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idIndex = headers.indexOf('id');

  if (idIndex === -1) {
    return createResponse({ error: 'id 컬럼을 찾을 수 없습니다' }, 400);
  }

  // ID로 행 찾기
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idIndex] == data.id) {
      rowIndex = i + 1; // 시트는 1부터 시작
      break;
    }
  }

  if (rowIndex === -1) {
    return createResponse({ error: '데이터를 찾을 수 없습니다' }, 404);
  }

  // 데이터 업데이트
  const row = headers.map(header => data[header] || '');
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);

  return createResponse({ success: true, data: data });
}

/**
 * 데이터 삭제
 */
function handleDelete(sheetName, id) {
  const sheet = getSheet(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idIndex = headers.indexOf('id');

  if (idIndex === -1) {
    return createResponse({ error: 'id 컬럼을 찾을 수 없습니다' }, 400);
  }

  // ID로 행 찾기
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idIndex] == id) {
      sheet.deleteRow(i + 1);
      return createResponse({ success: true, message: '삭제되었습니다' });
    }
  }

  return createResponse({ error: '데이터를 찾을 수 없습니다' }, 404);
}

/**
 * 일괄 데이터 추가
 */
function handleBulkAdd(sheetName, dataArray) {
  if (!Array.isArray(dataArray)) {
    return createResponse({ error: '배열 형식이 필요합니다' }, 400);
  }

  const sheet = getSheet(sheetName);

  // 헤더 확인
  if (sheet.getLastRow() === 0 && dataArray.length > 0) {
    const headers = Object.keys(dataArray[0]);
    sheet.appendRow(headers);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // ID 처리 및 데이터 추가
  dataArray.forEach(data => {
    // ID가 없거나 0이면 그대로 유지 (로컬에서 관리하므로)
    // Google Sheets에는 ID를 그대로 저장만 함
    // ID가 없으면 빈 값으로 저장 (로컬에서 나중에 부여)
    const row = headers.map(header => {
      const value = data[header];
      // ID가 0이면 빈 값으로 저장 (로컬에서 새로 부여할 예정)
      if (header === 'id' && (value === 0 || value === '0' || value === '')) {
        return '';
      }
      return value || '';
    });
    sheet.appendRow(row);
  });

  return createResponse({
    success: true,
    message: `${dataArray.length}개 항목이 추가되었습니다`,
    count: dataArray.length
  });
}

// ==================== 응답 생성 ====================

/**
 * JSON 응답 생성 (CORS 헤더 포함)
 */
function createResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== 테스트 함수 ====================

/**
 * 테스트용 샘플 데이터 추가
 */
function addSampleData() {
  // 문제 샘플
  const sampleQuestion = {
    id: Date.now(),
    category: '전기이론',
    question: '옴의 법칙은?',
    option1: 'V = IR',
    option2: 'V = I/R',
    option3: 'V = I + R',
    option4: 'V = I - R',
    answer: 1,
    explanation: '전압 = 전류 × 저항',
    imageUrl: '',
    questionImageUrl: '',
    option1ImageUrl: '',
    option2ImageUrl: '',
    option3ImageUrl: '',
    option4ImageUrl: ''
  };

  handleAdd(SHEETS.QUESTIONS, sampleQuestion);
  Logger.log('샘플 데이터가 추가되었습니다');
}
