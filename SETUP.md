# 부부 공용 DB(Supabase) 설정 가이드

이제 데이터가 폰에 저장되지 않고 인터넷의 공용 데이터베이스에 저장돼요. 랄프와 남편 두 분 모두 같은 설정값(config.js)을 넣은 앱을 쓰면, 누가 입력하든 양쪽 폰에서 똑같은 내용이 보입니다.

## 1. Supabase 가입 (폰/PC 브라우저 모두 가능)

1. https://supabase.com 접속 후 무료 가입 (GitHub 계정으로 가입하면 빠름)
2. "New project" 클릭 → 프로젝트 이름, 비밀번호 설정 (비밀번호는 따로 기억해두지 않아도 됨)
3. 리전은 "Northeast Asia (Seoul)" 선택 추천

## 2. 테이블 만들기

1. 왼쪽 메뉴에서 "SQL Editor" 클릭
2. 이 폴더의 `schema.sql` 파일 내용을 전부 복사해서 붙여넣기
3. "Run" 버튼 클릭 → transactions, meta, assets, asset_snapshots 테이블이 생성됨

## 3. 접속 정보 확인

1. 왼쪽 메뉴에서 "Project Settings" → "API" 클릭
2. "Project URL" 값 복사
3. "anon public" 키 값 복사

## 4. config.js 수정

`config.js` 파일을 열어서 다음 두 줄을 본인 값으로 바꿔주세요.

```js
const SUPABASE_URL = "복사한 Project URL";
const SUPABASE_ANON_KEY = "복사한 anon public 키";
```

## 5. 앱 배포 (남편과 같이 쓰려면 인터넷에 올려야 해요)

이 config.js가 적용된 폴더 전체를 Netlify 같은 곳에 올리고, 그 주소를 랄프와 남편 둘 다 폰에서 접속해서 "홈 화면에 추가"하면 됩니다. 같은 config.js를 쓰는 한, 누가 입력하든 같은 데이터베이스를 보게 돼요.

## 주의사항

- 이 설정은 로그인 없이 누구나 이 주소를 알면 데이터에 접근할 수 있는 "오픈" 방식이에요. 부부끼리 쓰는 용도로는 충분히 안전하지만, URL과 키를 외부에 공유하지 마세요.
- 무료 플랜 기준 데이터 용량 제한이 있지만, 가계부 수준의 데이터량으로는 몇 년을 써도 넉넉합니다.
