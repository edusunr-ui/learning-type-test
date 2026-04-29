# Google Sheets + 결과 PDF 자동 저장 설정

학생은 제출 완료 화면만 보고, 결과는 Google Sheets와 Google Drive PDF 파일로 선생님만 확인하는 운영용 설정입니다.

PDF 저장 방식은 2가지입니다.

1. 기본 방식: 유형별 기존 PDF 템플릿을 그대로 복사 저장
2. 권장 방식: 클라우드 PDF 서비스가 `teacher-result.html`을 렌더링해서 기존 결과확인 페이지 형식 그대로 저장

## 준비할 것

1. 결과를 저장할 Google Sheets
2. Apps Script 웹앱
3. 결과 PDF를 저장할 Google Drive 폴더
   비워두면 내 드라이브 루트에 저장됩니다.

## 1. 시트 ID와 폴더 ID 준비

### 스프레드시트 ID

예를 들어 시트 주소가 아래와 같다면:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
```

ID는 아래 부분입니다.

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Drive 폴더 ID

결과 PDF를 따로 저장할 폴더를 만들어 두었다면, 폴더 주소에서 ID를 복사합니다.

예를 들어:

```text
https://drive.google.com/drive/folders/1XyZaBcDeFgHiJkLmNoPqRsTuVwXyZ123
```

폴더 ID는 아래 부분입니다.

```text
1XyZaBcDeFgHiJkLmNoPqRsTuVwXyZ123
```

## 2. Apps Script 코드 넣기

구글 시트에서 `확장 프로그램 > Apps Script`로 들어간 뒤, `Code.gs` 전체를
`[google-apps-script.gs](Z:\01. 개인 폴더\04. 강다슬\학습유형검사\docs\google-apps-script.gs)`의 내용으로 교체하세요.

바꿔야 할 상수는 맨 위 3개입니다.

```javascript
const SPREADSHEET_ID = "여기에_실제_구글시트_ID";
const SHEET_NAME = "Results";
const PDF_FOLDER_ID = "여기에_드라이브_폴더_ID";
```

폴더를 따로 지정하지 않을 거면 이렇게 둬도 됩니다.

```javascript
const PDF_FOLDER_ID = "";
```

## 3. 웹앱 배포

1. 저장
2. 오른쪽 위 `배포`
3. `새 배포` 또는 `배포 관리 > 수정`
4. 유형은 `웹 앱`
5. 실행 계정은 `나`
6. 액세스 권한은 `모든 사용자`
7. 배포 후 나온 웹앱 URL 복사

브라우저에서 그 URL을 직접 열었을 때 아래처럼 보이면 정상입니다.

```json
{"ok":true,"message":"Learning type sheet endpoint is running."}
```

## 4. 사이트 연결

`[sheets-config.js](Z:\01. 개인 폴더\04. 강다슬\학습유형검사\docs\sheets-config.js)`의 `endpoint`에 방금 배포한 웹앱 URL을 넣습니다.

```javascript
window.LEARNING_TYPE_CONFIG = {
  googleSheets: {
    endpoint: "https://script.google.com/macros/s/배포아이디/exec",
  },
};
```

## 5. 저장되는 항목

시트에는 아래 항목이 저장됩니다.

- 학생 정보: 학교명, 학년, 이름, 검사급
- 원본 응답: `answersJson`
- 계산 결과: `resultCode`, `resultType`
- 6개 영역 점수
- 3개 비교 결과
- 결과 PDF 파일 정보
  - `resultPdfFileId`
  - `resultPdfUrl`
  - `resultPdfName`

## 6. PDF 파일 형태

이 설정은 결과유형별 기존 PDF 템플릿을 그대로 Google Drive에 복사 저장하는 방식입니다.
즉, 기존 검사결과확인 페이지에서 열리던 결과지 형식과 동일한 PDF가 저장됩니다.

현재 저장되는 PDF는:

- 유형별 기존 결과지 디자인을 그대로 사용
- 학생별로 파일명이 다르게 저장됨
- PDF 본문 안에 학생 이름이 새로 인쇄되지는 않음

예:

- `홍길동_러셀형_20260429_1530.pdf`
- `김민지_가우스형_20260429_1542.pdf`

## 운영 메모

- 학생 화면에서는 결과를 직접 볼 수 없습니다.
- 시트에서 `resultPdfUrl`을 클릭하면 선생님이 기존 결과지 형식 PDF를 바로 열 수 있습니다.
- 같은 `attemptId`로 다시 제출되면 기존 행을 업데이트하고, 기존 PDF는 휴지통으로 보낸 뒤 새 PDF를 만듭니다.
- 학생 이름까지 PDF 본문 첫 장에 인쇄되게 하려면, 그건 기존 템플릿 PDF 위에 오버레이를 얹는 다음 단계 작업이 필요합니다.

## 7. 기존 결과확인 페이지 형식 그대로 저장하려면

`Apps Script`만으로는 웹 결과 페이지를 그대로 PDF로 렌더링할 수 없어서, 클라우드 PDF 생성기를 같이 써야 합니다.

저장소 안에 아래 서버 코드가 추가되어 있습니다.

- [cloud-pdf-service/README.md](Z:\01. 개인 폴더\04. 강다슬\학습유형검사\cloud-pdf-service\README.md)
- [cloud-pdf-service/src/index.mjs](Z:\01. 개인 폴더\04. 강다슬\학습유형검사\cloud-pdf-service\src\index.mjs)

이 서비스를 배포한 뒤 `Code.gs` 상단에 아래 값을 채우면 됩니다.

```javascript
const CLOUD_PDF_ENDPOINT = "https://your-service.example.com/generate-result-pdf";
const CLOUD_PDF_TOKEN = "원하는_임의_토큰";
```

이 값을 채우면:

- 학생 제출
- Apps Script가 결과 계산
- 클라우드 PDF 서비스가 `teacher-result.html`을 렌더링
- 기존 결과확인 페이지 형식 PDF 생성
- Google Drive 저장
- 시트에 `resultPdfUrl` 기록
