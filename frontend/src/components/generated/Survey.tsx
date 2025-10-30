// 파일: src/components/generated/Survey.tsx
import { useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env'; // generated/에서 두 단계 상위

// -------------------- 타입/상수 --------------------
type Axis = 'OD' | 'SR' | 'PN' | 'WT';

interface Item {
  id: string;
  axis: Axis;
  text: string;
  reverse: boolean; // true면 점수 반전(6 - x)
  rightLetter: 'O' | 'S' | 'P' | 'W';
}

const SURVEY_V1: Item[] = [
  {
    id: 'Q1',
    axis: 'OD',
    text: '세안 후 30분 이내에 얼굴이 당기거나 건조하게 느껴진다.',
    reverse: true,
    rightLetter: 'O',
  },
  {
    id: 'Q2',
    axis: 'OD',
    text: '오후가 되면 T존(이마·코)이 번들거린다.',
    reverse: false,
    rightLetter: 'O',
  },
  {
    id: 'Q3',
    axis: 'OD',
    text: '파운데이션이 자주 뜨고 각질이 부각된다.',
    reverse: true,
    rightLetter: 'O',
  },

  {
    id: 'Q4',
    axis: 'SR',
    text: '새 제품 사용 시 화끈거림·따가움·가려움이 자주 생긴다.',
    reverse: false,
    rightLetter: 'S',
  },
  {
    id: 'Q5',
    axis: 'SR',
    text: '계절/온도 변화에 따라 홍조가 쉽게 나타난다.',
    reverse: false,
    rightLetter: 'S',
  },
  {
    id: 'Q6',
    axis: 'SR',
    text: '알레르기/아토피·여드름 등 피부 트러블 병력이 있다.',
    reverse: false,
    rightLetter: 'S',
  },

  {
    id: 'Q7',
    axis: 'PN',
    text: '기미·잡티가 쉽게 생기거나 오래 남는다.',
    reverse: false,
    rightLetter: 'P',
  },
  {
    id: 'Q8',
    axis: 'PN',
    text: '외출 시 자외선 차단을 자주 빼먹는 편이다.',
    reverse: false,
    rightLetter: 'P',
  },
  {
    id: 'Q9',
    axis: 'PN',
    text: '여드름·상처 후 갈색/붉은 자국(PIH/PIE)이 오래 남는다.',
    reverse: false,
    rightLetter: 'P',
  },

  {
    id: 'Q10',
    axis: 'WT',
    text: '눈가/팔자 등 표정 주름이 점점 또렷해진다.',
    reverse: false,
    rightLetter: 'W',
  },
  {
    id: 'Q11',
    axis: 'WT',
    text: '밤샘/스트레스 후 피부 탄력이 확 떨어진다.',
    reverse: false,
    rightLetter: 'W',
  },
  {
    id: 'Q12',
    axis: 'WT',
    text: '건조한 곳에서 미세주름(건성주름)이 잘 생긴다.',
    reverse: false,
    rightLetter: 'W',
  },
];

const TIEBREAKERS: Record<Axis, Item[]> = {
  OD: [
    {
      id: 'OD_TB1',
      axis: 'OD',
      text: '스킨/토너만 바르고 1시간 뒤 T존 번들거림을 닦아낸 적이 자주 있다.',
      reverse: false,
      rightLetter: 'O',
    },
    {
      id: 'OD_TB2',
      axis: 'OD',
      text: '파데·쿠션이 자주 뜨고 각질이 부각된다.',
      reverse: true,
      rightLetter: 'O',
    },
  ],
  SR: [
    {
      id: 'SR_TB1',
      axis: 'SR',
      text: '약한 각질제거제·레티노이드에도 따가움/홍조가 쉽게 생긴다.',
      reverse: false,
      rightLetter: 'S',
    },
    {
      id: 'SR_TB2',
      axis: 'SR',
      text: '향/알코올/에센셜오일에도 자극을 거의 느끼지 않는다.',
      reverse: true,
      rightLetter: 'S',
    },
  ],
  PN: [
    {
      id: 'PN_TB1',
      axis: 'PN',
      text: '여름 야외활동 후 피부 톤이 쉽게 어두워지고 오래 돌아오지 않는다.',
      reverse: false,
      rightLetter: 'P',
    },
    {
      id: 'PN_TB2',
      axis: 'PN',
      text: '트러블이 사라진 뒤 자국(PIH/PIE)이 수주 이상 남는다.',
      reverse: false,
      rightLetter: 'P',
    },
  ],
  WT: [
    {
      id: 'WT_TB1',
      axis: 'WT',
      text: '표정 습관(찌푸림 등) 자국/잔주름이 쉽게 사라지지 않는다.',
      reverse: false,
      rightLetter: 'W',
    },
    {
      id: 'WT_TB2',
      axis: 'WT',
      text: '수분크림만으로도 건조 주름이 금방 펴지는 편이다.',
      reverse: true,
      rightLetter: 'W',
    },
  ],
};

const AXES: Axis[] = ['OD', 'SR', 'PN', 'WT'];
const LEFT_LETTER: Record<Axis, 'D' | 'R' | 'N' | 'T'> = { OD: 'D', SR: 'R', PN: 'N', WT: 'T' };
const RIGHT_LETTER: Record<Axis, 'O' | 'S' | 'P' | 'W'> = { OD: 'O', SR: 'S', PN: 'P', WT: 'W' };

// -------------------- 유틸 --------------------
function applyReverse(x: number, reverse: boolean) {
  return reverse ? 6 - x : x;
}

function avgAndStats(values: (number | null)[], items: Item[]) {
  let unknown = 0;
  const scored = values.map((v, i) => {
    if (v == null) {
      unknown += 1;
      v = 3; // 모름은 3점
    }
    return applyReverse(v, items[i].reverse);
  });
  const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
  const mean = avg;
  const variance = scored.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (scored.length || 1);
  const stdev = Math.sqrt(variance);
  return { avg, unknown, stdev, scored };
}

function decideLetter(avg: number, axis: Axis): string | null {
  if (avg <= 2.6) return LEFT_LETTER[axis];
  if (avg >= 3.4) return RIGHT_LETTER[axis];
  return null;
}

function confidence(stdev: number, unknownCnt: number, usedTb: boolean) {
  const base = 100;
  const penalty = stdev * 10 + unknownCnt * 5 + (usedTb ? 5 : 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

type Responses = Record<string, number | null>;

function evaluate(resps: Responses, tbResps: Responses) {
  const result: {
    axes: Record<
      Axis,
      { avg: number; letter: string | null; conf: number; usedTb: boolean; tbId?: string }
    >;
    neededTB: { axis: Axis; item: Item }[];
    typeCode: string | null;
    confOverall: number | null;
  } = { axes: {} as any, neededTB: [], typeCode: null, confOverall: null };

  const letters: (string | null)[] = [];
  const confs: number[] = [];

  for (const axis of AXES) {
    const baseItems = SURVEY_V1.filter(it => it.axis === axis);
    const baseVals = baseItems.map(it => resps[it.id] ?? null);
    let { avg, unknown, stdev } = avgAndStats(baseVals, baseItems);
    let letter = decideLetter(avg, axis);
    let usedTb = false;
    let tbId: string | undefined;

    if (!letter) {
      const tb = TIEBREAKERS[axis][0];
      tbId = tb.id;
      if (tbResps[tb.id] == null) {
        const conf = confidence(stdev, unknown, false);
        result.axes[axis] = { avg: round2(avg), letter: null, conf, usedTb: false };
        result.neededTB.push({ axis, item: tb });
        letters.push(null);
        continue;
      }
      const tbVal = tbResps[tb.id] ?? 3;
      const tbScored = applyReverse(tbVal, tb.reverse);
      avg = (avg * baseItems.length + tbScored) / (baseItems.length + 1);
      letter = decideLetter(avg, axis) ?? (avg >= 3.0 ? RIGHT_LETTER[axis] : LEFT_LETTER[axis]);
      stdev += 0.2;
      usedTb = true;
    }

    const conf = confidence(stdev, unknown, usedTb);
    result.axes[axis] = { avg: round2(avg), letter, conf, usedTb, tbId };
    letters.push(letter);
    confs.push(conf);
  }

  result.typeCode = letters.every(l => !!l) ? (letters as string[]).join('') : null;
  result.confOverall = confs.length
    ? round1(confs.reduce((a, b) => a + b, 0) / confs.length)
    : null;
  return result;
}

// -------------------- 컴포넌트 --------------------
export default function Survey({ onDone }: { onDone: () => void }) {
  // 1) 기본 12문항 응답
  const [responses, setResponses] = useState<Responses>(() =>
    Object.fromEntries(SURVEY_V1.map(i => [i.id, null]))
  );
  // 2) 타이브레이커 응답
  const [tbResponses, setTbResponses] = useState<Responses>({});
  // 3) 1차 결과/필요한 타이브레이커
  const [neededTB, setNeededTB] = useState<{ axis: Axis; item: Item }[]>([]);
  const [final, setFinal] = useState<null | ReturnType<typeof evaluate>>(null);
  // 4) 저장 상태
  const [saving, setSaving] = useState(false);

  const axisTitle: Record<Axis, string> = {
    OD: '지성↔건성 (OD)',
    SR: '민감↔저항 (SR)',
    PN: '색소↔비색소 (PN)',
    WT: '주름↔탄탄 (WT)',
  };

  const grouped = useMemo(() => {
    return AXES.map(axis => ({
      axis,
      title: axisTitle[axis],
      items: SURVEY_V1.filter(i => i.axis === axis),
    }));
  }, []);

  // 라디오 버튼 공통
  const Radio = (v: number | null, onChange: (x: number | null) => void) => (
    <div className="flex gap-2 flex-wrap">
      {[1, 2, 3, 4, 5].map(n => (
        <label
          key={n}
          className={`px-3 py-1.5 rounded-lg border cursor-pointer select-none ${
            v === n
              ? 'bg-purple-600 text-white border-purple-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <input type="radio" className="hidden" checked={v === n} onChange={() => onChange(n)} />
          {n}
        </label>
      ))}
      <label
        className={`px-3 py-1.5 rounded-lg border cursor-pointer select-none ${
          v == null
            ? 'bg-gray-900 text-white border-gray-900'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          className="hidden"
          checked={v == null}
          onChange={() => onChange(null)}
        />
        모름
      </label>
    </div>
  );

  const scoreOnce = () => {
    const r1 = evaluate(responses, tbResponses);
    setNeededTB(r1.neededTB);
    setFinal(r1);
  };

  const scoreFinal = () => {
    const r2 = evaluate(responses, tbResponses);
    setFinal(r2);
    setNeededTB([]);
  };

  const resetAll = () => {
    setResponses(Object.fromEntries(SURVEY_V1.map(i => [i.id, null])));
    setTbResponses({});
    setNeededTB([]);
    setFinal(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 저장 + 이동
  const handleSaveAndGo = async () => {
    if (!final?.typeCode) return;

    const axesPayload = Object.fromEntries(
      AXES.map(ax => {
        const a = final.axes[ax];
        return [ax, { avg: a.avg, letter: a.letter, confidence: a.conf }];
      })
    );

    // user_id는 백엔드에서 int로 받도록 되어 있음
    const userIdStr = localStorage.getItem('user_id') ?? '1';
    const user_id = Number.parseInt(userIdStr, 10) || 1;

    const nickname = localStorage.getItem('nickname') ?? null;
    const birthYearStr = localStorage.getItem('birth_year') ?? '';
    const birth_year = birthYearStr ? Number(birthYearStr) : undefined;
    const gender = localStorage.getItem('gender') ?? 'na';

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/api/profile/skin-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id, // number
          skin_type_code: final.typeCode, // string(예: ORNT)
          skin_axes_json: JSON.stringify(axesPayload), // ✅ 백엔드가 str로 받으므로 문자열화
          nickname,
          birth_year, // number | undefined
          gender,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${detail}`);
      }

      // 로컬 캐시 → 대시보드에서 즉시 반영
      localStorage.setItem('skin_type_code', final.typeCode);
      localStorage.setItem('skin_axes_json', JSON.stringify(axesPayload));

      onDone();
    } catch (err) {
      console.error('save error:', err);
      alert('저장에 실패했어요. 콘솔 로그를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: 'linear-gradient(135deg,#fce7f3 0%,#f3e8ff 50%,#ddd6fe 100%)' }}
    >
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">바우만 피부타입 설문</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-5 mb-6">
          <p className="text-gray-700">
            각 문항에 대해 <b>1=전혀 아니다</b> ~ <b>5=매우 그렇다</b> 중 선택하세요. 애매하면{' '}
            <b>모름</b>을 선택해도 됩니다.
          </p>
        </div>

        {/* 12문항 리스트 */}
        {useMemo(
          () =>
            AXES.map(axis => {
              const titleMap: Record<Axis, string> = {
                OD: '지성↔건성 (OD)',
                SR: '민감↔저항 (SR)',
                PN: '색소↔비색소 (PN)',
                WT: '주름↔탄탄 (WT)',
              };
              const items = SURVEY_V1.filter(i => i.axis === axis);
              return (
                <div
                  key={axis}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5"
                >
                  <h2 className="font-semibold text-gray-800 mb-3">{titleMap[axis]}</h2>
                  <ul className="space-y-4">
                    {items.map(it => (
                      <li key={it.id} className="flex flex-col gap-2">
                        <div className="text-gray-800">{it.text}</div>
                        {Radio(responses[it.id] ?? null, x =>
                          setResponses(prev => ({ ...prev, [it.id]: x }))
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }),
          [responses]
        )}

        {/* 1차 채점 */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={scoreOnce}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:opacity-95"
            title="타이브레이커 필요 여부까지 계산"
          >
            결과 보기
          </button>

          {final?.typeCode && (
            <span className="text-gray-700">
              예비 타입: <b>{final.typeCode}</b> (확신도 {final.confOverall})
            </span>
          )}
        </div>

        {/* 타이브레이커 */}
        {neededTB.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 mb-6">
            <h3 className="font-semibold text-amber-700 mb-3">추가 확인 문항</h3>
            <ul className="space-y-4">
              {neededTB.map(({ axis, item }) => (
                <li key={item.id} className="flex flex-col gap-2">
                  <div className="text-gray-800">
                    [{axis}] {item.text}
                  </div>
                  {Radio(tbResponses[item.id] ?? null, x =>
                    setTbResponses(prev => ({ ...prev, [item.id]: x }))
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex justify-center">
              <button
                onClick={scoreFinal}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:opacity-95"
                title="타이브레이커 포함 최종 결과 계산"
              >
                최종 결과 보기
              </button>
            </div>
          </div>
        )}

        {/* 최종 결과 */}
        {final?.typeCode && neededTB.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-200 p-5 mb-6">
            <h3 className="font-semibold text-violet-700 mb-3">최종 결과</h3>
            <p className="text-gray-800">
              <b>바우만 타입: {final.typeCode}</b> &nbsp;|&nbsp; 확신도 {final.confOverall}/100
            </p>
            <ul className="mt-3 space-y-1 text-gray-700">
              {AXES.map(ax => {
                const a = final.axes[ax];
                const left = LEFT_LETTER[ax],
                  right = RIGHT_LETTER[ax];
                return (
                  <li key={ax}>
                    - <b>{ax}</b>: 평균 {a.avg} / 판정 <b>{a.letter}</b> (신뢰도 {a.conf})
                    &nbsp;·&nbsp; {left} ← {((a.avg - 1) / 4).toFixed(2)} → {right}
                    {a.usedTb ? ' · 타이브레이커 반영' : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={resetAll}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-800 font-semibold hover:bg-gray-50"
            title="처음부터 다시"
          >
            다시하기
          </button>

          <button
            onClick={handleSaveAndGo}
            disabled={saving || !final?.typeCode}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-pink-600 text-white font-semibold hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
            title="진단 결과 저장 후 대시보드로 이동"
          >
            {saving ? '저장 중...' : '저장하고 대시보드로'}
          </button>
        </div>
      </div>
    </div>
  );
}
