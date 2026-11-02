/** 一般公開前の版には架空の日付を出さず、準備中と伝える。 */
export function VersionDate({ released, date }: { released?: boolean; date: string }) {
  const className = "text-xs font-medium text-nicchyo-ink/55";
  return released === false
    ? <span className={className}>公開準備中</span>
    : <time className={className} dateTime={date}>{date}</time>;
}
