/**
 * 写真入りの屋台の絵を、どの細かさ（pixelRatio）で頼み、どの細かさで登録したかの記録。
 *
 * 写真入りの屋台はふだん等倍用（baseRatio）で描くが、最大ズームより先の一段では 2 倍に
 * 拡大されるので、画面に見えている店だけ細かい版（baseRatio より大きい pixelRatio）で描き直す。
 * 描き起こしは非同期で、等倍版と細かい版のジョブが前後したり、片方が失敗したりする。
 * どの結果を採用し、失敗したら何に戻すかをここで決める（MapLibre には触らない純粋な記録）。
 *
 * 細かい版は 1 枚が大きい（dpr 3 で約 1.1MB）ので、上限（maxDetail）を超えたら
 * 最も長く使っていないものから等倍版に戻す。
 */
export class PhotoSpriteRegistry {
  /** 最後に頼んだ pixelRatio（描き起こし中か、それが登録済み） */
  private readonly requested = new Map<string, number>();
  /** 登録済みの pixelRatio */
  private readonly registered = new Map<string, number>();
  /** 細かい版で登録済みの ID。古く使ったものほど前（Map は入れた順を保つ） */
  private readonly detailOrder = new Map<string, true>();

  constructor(private readonly options: { baseRatio: number; maxDetail: number }) {}

  /** 一度でも頼んだことがあるか */
  has(id: string): boolean {
    return this.requested.has(id);
  }

  /**
   * ratio で描き起こすべきか。true を返したら、頼んだものとして記録する。
   * 同じ細かさを頼み済み（描き起こし中・登録済み）なら false。
   * より細かい版を頼み済みなら、downgrade（上限を超えて等倍に戻すとき）以外は false。
   */
  want(id: string, ratio: number, downgrade = false): boolean {
    const current = this.requested.get(id);
    if (current === ratio) return false;
    if (current !== undefined && current > ratio && !downgrade) return false;
    this.requested.set(id, ratio);
    return true;
  }

  /**
   * 描き起こしが終わった。採用すべきなら true（その後に別の細かさを頼んでいたら false で、結果は捨てる）。
   */
  done(id: string, ratio: number): boolean {
    if (this.requested.get(id) !== ratio) return false;
    this.registered.set(id, ratio);
    this.detailOrder.delete(id);
    if (ratio > this.options.baseRatio) this.detailOrder.set(id, true);
    return true;
  }

  /** 描き起こしに失敗した。登録済みの細かさに戻して、次の機会に頼み直せるようにする */
  failed(id: string, ratio: number): void {
    if (this.requested.get(id) !== ratio) return;
    const registered = this.registered.get(id);
    if (registered === undefined) {
      this.requested.delete(id);
      return;
    }
    this.requested.set(id, registered);
    // 等倍に戻す描き起こしが失敗したときは、細かい版が残るので、また上限の対象にする
    if (registered > this.options.baseRatio) this.detailOrder.set(id, true);
  }

  /** 今使っている（画面に見えている）。細かい版なら、上限で戻す順番を後ろへ回す */
  touch(id: string): void {
    if (!this.detailOrder.has(id)) return;
    this.detailOrder.delete(id);
    this.detailOrder.set(id, true);
  }

  /** 上限を超えた細かい版の ID（最も長く使っていないものから）。呼び出し側で等倍版に戻す */
  overflow(): string[] {
    const excess = this.detailOrder.size - this.options.maxDetail;
    if (excess <= 0) return [];
    const ids = Array.from(this.detailOrder.keys()).slice(0, excess);
    for (const id of ids) this.detailOrder.delete(id);
    return ids;
  }
}
