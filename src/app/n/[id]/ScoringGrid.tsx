"use client";

type Interest = { id: string; text: string; points: number; mustHave: boolean };
type Option = { id: string; shortName: string };
export type ScoreState = { value: number | null; na: boolean };

function cellValue(s: ScoreState): string {
  if (s.na) return "na";
  if (s.value === null) return "blank";
  return String(s.value);
}

function fromCellValue(v: string): ScoreState | null {
  if (v === "blank") return null; // clear
  if (v === "na") return { value: null, na: true };
  return { value: Number(v), na: false };
}

export default function ScoringGrid({
  partyName,
  interests,
  options,
  getScore,
  onSet,
}: {
  partyName: string;
  interests: Interest[];
  options: Option[];
  getScore: (optionId: string, interestId: string) => ScoreState;
  onSet: (optionId: string, interestId: string, next: ScoreState | null) => void;
}) {
  if (interests.length === 0 || options.length === 0) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm">
        Add some interests (steps 2–3) and a few ideas (step 4) first — then{" "}
        {partyName} can score them here.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-stone-900">
        {partyName}: score the ideas
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        For each idea, how well does it meet each interest? ○ none → ● perfect,
        “n/a” if it doesn&apos;t apply, or leave blank if no opinion. You score{" "}
        <em>everyone&apos;s</em> interests, not just your own.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-medium text-stone-400">
                idea \ interest
              </th>
              {interests.map((i) => (
                <th
                  key={i.id}
                  className="min-w-[7.5rem] max-w-[10rem] p-2 align-bottom text-left text-xs font-medium text-stone-600"
                >
                  <div className="line-clamp-3" title={i.text}>
                    {i.text}
                  </div>
                  <div className="mt-1 text-stone-400">
                    {i.mustHave ? (
                      <span className="font-medium text-amber-600">★ must-have</span>
                    ) : (
                      `${i.points} pt${i.points === 1 ? "" : "s"}`
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map((o) => (
              <tr key={o.id} className="border-t border-stone-100">
                <th className="min-w-[10rem] max-w-[16rem] p-2 text-left text-sm font-medium text-stone-700">
                  <div className="line-clamp-2" title={o.shortName}>
                    {o.shortName}
                  </div>
                </th>
                {interests.map((i) => {
                  const s = getScore(o.id, i.id);
                  return (
                    <td key={i.id} className="p-1 text-center">
                      <select
                        value={cellValue(s)}
                        onChange={(e) =>
                          onSet(o.id, i.id, fromCellValue(e.target.value))
                        }
                        className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-sm text-stone-800 outline-none focus:border-emerald-500"
                      >
                        <option value="blank">–</option>
                        <option value="0">○ 0%</option>
                        <option value="25">◔ 25%</option>
                        <option value="50">◑ 50%</option>
                        <option value="75">◕ 75%</option>
                        <option value="100">● 100%</option>
                        <option value="na">n/a</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
