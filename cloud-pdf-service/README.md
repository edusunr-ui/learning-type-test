# Cloud PDF Service

기존 `teacher-result.html` 결과 페이지를 브라우저로 렌더링한 뒤 PDF로 출력하고, Google Drive에 업로드하는 서버입니다.

## 목적

- 학생이 어떤 노트북/휴대폰에서 검사를 해도
- 같은 형식의 결과지 PDF를 자동 생성하고
- Google Drive에 저장

## 필요한 환경 변수

```text
PORT=8080
RESULT_RENDER_URL=https://edusunr-ui.github.io/learning-type-test/teacher-result.html
GOOGLE_DRIVE_FOLDER_ID=드라이브_폴더_ID
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
PDF_SERVICE_TOKEN=원하는_임의_토큰
```

## 준비

1. Google Cloud 서비스 계정 생성
2. Drive API 활성화
3. 결과 PDF를 저장할 구글 드라이브 폴더를 서비스 계정 이메일에 편집 권한으로 공유
4. 위 환경 변수 설정

## 실행

```bash
npm install
npm start
```

## 엔드포인트

### `GET /health`

```json
{"ok":true}
```

### `POST /generate-result-pdf`

헤더:

```text
Authorization: Bearer <PDF_SERVICE_TOKEN>
Content-Type: application/json
```

본문 예시:

```json
{
  "attemptId": "abc123",
  "createdAt": "2026-04-29T08:00:00.000Z",
  "submittedAt": "2026-04-29T08:00:00.000Z",
  "school": "산들중",
  "grade": "1",
  "name": "곽소율",
  "level": "elementary",
  "levelLabel": "초등부",
  "resultCode": "BDE",
  "resultType": "데카르트형",
  "positiveScore": "18",
  "negativeScore": "28",
  "internalScore": "28",
  "externalScore": "28",
  "logicalScore": "28",
  "intuitiveScore": "28"
}
```

응답 예시:

```json
{
  "ok": true,
  "resultPdfFileId": "1abc...",
  "resultPdfUrl": "https://drive.google.com/file/d/1abc/view",
  "resultPdfName": "26.04.29_산들중_1_곽소율_데카르트형.pdf"
}
```

## Apps Script 연동

`docs/google-apps-script.gs` 상단에 아래 값을 넣으면 됩니다.

```javascript
const CLOUD_PDF_ENDPOINT = "https://your-service.example.com/generate-result-pdf";
const CLOUD_PDF_TOKEN = "원하는_임의_토큰";
```

비워두면 기존 템플릿 PDF 복사 방식으로 동작합니다.
