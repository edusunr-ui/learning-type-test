# Google Sheets + 선생님 전용 결과 페이지 설정

학생은 검사만 제출하고, 결과는 선생님만 비밀번호로 로그인해서 확인하는 운영 방식입니다.

구성은 이렇게 됩니다.

1. 학생용 페이지 `index.html`
- 검사 응답만 제출
- 제출 완료 화면만 표시

2. 선생님용 페이지 `teacher-admin.html`
- 비밀번호 로그인
- 결과 목록 조회
- 개별 결과지 열기
- 기존 결과지 형식으로 브라우저 인쇄 가능

3. Apps Script
- 학생 제출 데이터 저장
- 결과 계산
- 선생님 로그인 세션 발급
- 결과 목록/상세 API 제공

## 1. 준비할 값

Apps Script 상단에서 아래 값을 직접 채워 주세요.

```javascript
const SPREADSHEET_ID = "여기에_실제_구글시트_ID를_넣으세요";
const SHEET_NAME = "Results";
const PDF_FOLDER_ID = "";
const ADMIN_PASSWORD = "여기에_선생님용_비밀번호를_넣으세요";
```

선택 항목:

```javascript
const CLOUD_PDF_ENDPOINT = "";
const CLOUD_PDF_TOKEN = "";
```

`PDF_FOLDER_ID`는 기존처럼 PDF를 Drive에 저장할 때만 필요합니다.  
선생님 전용 결과 페이지만 쓸 거면 비워 둬도 됩니다.

## 2. Apps Script 코드 교체

구글 시트에서:

1. `확장 프로그램 > Apps Script`
2. `Code.gs` 전체 삭제
3. 저장소의 `docs/google-apps-script.gs` 전체 복붙
4. `SPREADSHEET_ID`, `ADMIN_PASSWORD` 값 수정
5. 저장

저장소 파일:
[google-apps-script.gs](\\?\UNC\ARSPomHS1\기획운영D\01. 개인 폴더\04. 강다슬\학습유형검사\docs\google-apps-script.gs)

## 3. 웹앱 다시 배포

1. Apps Script에서 `배포`
2. `배포 관리`
3. 기존 웹앱 `수정` 또는 `새 배포`
4. 유형 `웹 앱`
5. 액세스 권한 `모든 사용자`
6. 배포

배포 후 웹앱 URL이 그대로일 수도 있고 바뀔 수도 있습니다.

브라우저에서 URL을 직접 열었을 때 아래처럼 보이면 정상입니다.

```json
{"ok":true,"message":"Learning type sheet endpoint is running."}
```

## 4. 사이트 설정

`docs/sheets-config.js`의 `endpoint`에 방금 배포한 웹앱 URL이 들어 있어야 합니다.

파일:
[sheets-config.js](\\?\UNC\ARSPomHS1\기획운영D\01. 개인 폴더\04. 강다슬\학습유형검사\docs\sheets-config.js)

형식:

```javascript
window.LEARNING_TYPE_CONFIG = {
  googleSheets: {
    endpoint: "https://script.google.com/macros/s/배포아이디/exec",
  },
};
```

## 5. 선생님 전용 페이지 주소

배포 반영 후 선생님이 여는 주소:

```text
https://edusunr-ui.github.io/learning-type-test/teacher-admin.html
```

여기서:

1. `ADMIN_PASSWORD`로 로그인
2. 제출된 결과 목록 확인
3. `결과 보기` 클릭
4. 기존 결과지 형식 페이지 확인
5. 브라우저 `인쇄 / PDF 저장`

## 6. 결과 목록에서 보이는 항목

- 제출 시각
- 학교명
- 학년
- 이름
- 검사급
- 결과 코드
- 결과 유형
- 기존에 저장된 PDF 링크가 있으면 `저장된 PDF`

## 7. 운영 메모

- 학생은 결과 페이지를 직접 볼 수 없습니다.
- 선생님만 `teacher-admin.html`에서 로그인 후 결과를 확인합니다.
- 결과지 출력은 브라우저 인쇄로 진행하면 예전 결과 페이지 형식 그대로 사용할 수 있습니다.
- 비밀번호를 바꾸려면 Apps Script의 `ADMIN_PASSWORD`를 수정한 뒤 다시 배포해야 합니다.
