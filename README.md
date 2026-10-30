# 재즈 즉흥 악보 생성기 (Jazz Solo Generator)

코드 진행을 고르면 **매번 새로운** 연습용 즉흥 솔로 악보를 만들어 주고, 반주와 함께 들려 주는 단일 HTML 웹앱.
규칙 기반 엔진(v0.12)이 **Weimar Jazz Database 실측 통계**를 확률로 사용해 "사람 같은" 라인을 만든다.

> 마스터 기획안: [docs/blueprint-v1.0.pdf](docs/blueprint-v1.0.pdf) — 프로젝트 전체 로드맵(v1~v4), ML·RAG 확장 설계, 비용·법무 프레임.

## 실행

빌드가 끌어진 결과물 하나(`index.html`)로 완결된 앱이다. 파일을 브라우저로 열면 끝난다.

```bash
# 방법 1: 그냥 열기
open index.html            # macOS (Windows: start index.html)

# 방법 2: 로컬 서버 (권장)
python3 -m http.server 8000
# → http://localhost:8000
```

깃허브에 올리면 GitHub Pages로 그대로 데모를 제공할 수 있다(아래 "GitHub에 올리기").

## 폴더 구조

```
├── index.html              # 빌드 결과물 — 단일 파일 앱 (엔진+UI+재생 모두 포함)
├── app/
│   └── template.html       # 앱 템플릿 (빌드 마커 있음 — 이걸 수정하지 말고 engine/을 수정할 것)
├── engine/                 # 순수 로직 (UI와 분리 — Node로 단위 테스트 가능)
│   ├── engine_core.js      # 화성 분석·생성·ABC 변환 (핵심)
│   ├── style_data.js       # WJD 통계 프로필 + 공통 셀 (생성 데이터)
│   └── playback.js         # Web Audio 재생부 (스윙비·아티큘레이션·반주)
├── tools/                  # 데이터 파이프라인 + 테스트
│   ├── analyze.py          # wjazzd.db → 통계 추출 (리듬 전이·음 분포·공통 셀)
│   ├── phrase_stats.py     # wjazzd.db → 프레이즈 길이·쉼 분포
│   ├── export.py           # 통계 JSON → style_data.js용 블렌딩 프로필
│   ├── build.py            # template.html + engine/*.js → index.html
│   ├── test.js             # 945개 조합 전수 검증 (마디 완결·음역·도약·3연음)
│   ├── compare.js          # v0.11 대비 지표 비교
│   └── data/               # 추출된 통계 JSON (원 DB는 커밋하지 않음)
└── docs/
    ├── blueprint-v1.0.pdf  # 마스터 기획안 (로드맵·ML/RAG 설계·법무)
    └── solo-generator-v0.11.html  # 이전 버전 아카이브
```

## v0.12 엔진 — 한 소절이 만들어지는 6단계

v0.11까지는 "지금 이 코드에 어울리는 음"을 한 음씩 골랐다. 이 방식에는 라인에 방향이 생기지 않는다.
v0.12는 실제 연주자의 사고 순서인 **"다음 코드의 어디에 도착할지 먼저 정하고, 거기로 걸어간다"**를 그대로 구현했다.

1. **화성 분석** — 코드의 기능을 읽는다. D7→Gm은 "단조로 가는 Ⅴ"(♭9·♭13), G♭7→F는 트라이톤 대리(리디안 ♭7), Ⅳ 자리 maj7은 리디안, 토닉 마이너는 멜로딕 마이너. 같은 7th 코드라도 가는 곳에 따라 스케일이 달라진다.
2. **프레이즈·쉼 계획** — 연주자별 실측 프레이즈 길이·쉼 길이 분포로 호흡을 정하고, 형식(8마디) 경계 직전에 종지를 맞춘다. 목관은 최대 2마디마다 숨을 쉰다.
3. **리듬** — 박 단위 마르코프 체인. WJD 전사에서 잰 "이 박에서 다음 박으로 어떤 리듬이 오나" 확률로 만든다. 마디선을 넘는 붙임줄 당김음이 자연스럽게 생긴다.
4. **타깃음** — 코드가 바뀌는 다운비트에 가이드톤(3음·7음)을 먼저 정하고, 직전 음과 반음·온음이면 가중치를 높여 보이스리딩이 이어지게 한다.
5. **어프로치 역산** — 타깃 앞 1~2음을 반음 어프로치·스케일 어프로치·인클로저(위아래 감싸기)로 채운다. 크로매틱음은 약박에서 반음 진행으로만 쓴다.
6. **어휘 셀** — 남은 자리는 연주자 프로필의 "코드 대비 음 분포(강박/약박)"와 "음정 분포"로 채우고, WJD에서 4명 이상 연주자가 공통으로 쓴 4~5음 셀 134종을 음형 그대로 넣는다.

재생부: 템포별 실측 스윙비(120BPM 0.63 → 280BPM 0.54), 엇박 악센트, 붙임줄 한 소리화, 프레이즈 끝음 비브라토, 가이드톤 기반 루트리스 컴핑 보이싱, 박마다 코드를 읽는 워킹 베이스.

## 성능 지표 (같은 조건 생성 비교, %)

| 지표 | v0.11 → v0.12 (난이도 2) | v0.11 → v0.12 (난이도 3) | WJD 실측 |
|---|---|---|---|
| 강박 코드톤 | 69.8 → **81.5** | 62.6 → **72.4** | 58.8 |
| 코드 전환점 코드톤 착지 | 73.7 → **97.6** | 53.9 → **94.8** | — |
| 코드 전환점 가이드톤 | 39.1 → **67.4** | 28.1 → **66.7** | — |
| 같은 음 반복 | 9.8 → **4.8** | 9.7 → **4.3** | 4.3 |
| 6반음 이상 도약 | 7.5 → **3.3** | 7.5 → **3.5** | — |

전수 검증: 945개 조합(곡 5 × 조 7 × 난이도 3 × 악기 3 × 시드 3)에서 마디 완결·음역·도약·3연음 무결성 **위반 0건**. `node tools/test.js`로 재현.

## 데이터 출처

연주자 스타일 통계와 공통 셀은 [Weimar Jazz Database v2.1](https://jazzomat.hfm-weimar.de/download/download.html)(Jazzomat Research Project, HfM Weimar · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/))에서 추출했다. 앱에는 원 전사 음표열이 들어 있지 않다 — 확률 분포와 다수 연주자 공통 음형만 담는다. 자세한 고지와 상업화 체크리스트: [DATA-SOURCES.md](DATA-SOURCES.md).

수록 곡(Autumn Leaves, All of Me)은 **코드 진행만** 반영했으며 원곡 멜로디는 포함하지 않는다. 생성되는 악보는 새 선율이다.

## 개발 워크플로

```bash
# 1. 엔진 수정 (engine/engine_core.js, engine/playback.js)
# 2. 앱 다시 빌드
python3 tools/build.py
# 3. 전수 테스트 + v0.11 비교
node tools/test.js
node tools/compare.js
# 4. 통계 재추출이 필요하면 (42MB DB 다운로드 필요)
curl -LO https://jazzomat.hfm-weimar.de/download/downloads/wjazzd.db
python3 tools/analyze.py && python3 tools/phrase_stats.py && python3 tools/export.py
```

원칙: **엔진/프레젠테이션 분리**, **시드 기반 재현**(같은 시드 → 같은 악보). 이 원칙은 v1 이후에도 유지한다.

## GitHub에 올리기

처음 한 번:

```bash
# 1) github.com 에서 새 저장소 생성 (예: jazz-solo-generator) — README 자동 생성 체크 해제
# 2) 로컬에서
git config user.name "이름" && git config user.email "이메일"   # 최초 1회
git remote add origin https://github.com/<아이디>/jazz-solo-generator.git
git push -u origin main
```

이후 업데이트:

```bash
git add -A && git commit -m "변경 요약" && git push
```

GitHub Pages 데모: 저장소 Settings → Pages → Branch `main` / root 선택 후 저장. 몇 분 후 `https://<아이디>.github.io/jazz-solo-generator/`에서 앱이 바로 실행된다.
GitHub CLI를 쓰면 저장소 생성도 터미널에서: `gh auth login` → `gh repo create jazz-solo-generator --public --source=. --push`.

## v0.13

- 리얼북 스탠다드 코드 진행 99곡 + 연습용 3곡 = 총 102곡 수록 (멜로디·가사 미포함)
- 반음 단위 조 변환 스테퍼 (-11 ~ +11, 콘서트 기준 표기 — 기보용 B♭ 조와 별개)
- 3/4 · 5/4 박자 지원 (밀티얼 월츠, Take Five 등)
- 간소화 UI: 곡 선택 박스 · 아티스트 스타일 박스 · 실시간 검색
- ▶ 재생 버튼 토글 바인딩 (정지 동작 포함) 버그 수정
