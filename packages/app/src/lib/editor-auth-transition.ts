export class EditorAuthTransitionGuard {
  constructor(public acceptedUserId: string | null) {}

  async transition(
    nextUserId: string | null,
    prepare: () => Promise<boolean>,
    commitIfCurrent: () => boolean = () => true,
  ): Promise<boolean> {
    if (nextUserId === this.acceptedUserId) return true;
    let prepared = false;
    try {
      prepared = await prepare();
    } catch {
      return false;
    }
    if (!prepared) return false;
    if (!commitIfCurrent()) return false;
    this.acceptedUserId = nextUserId;
    return true;
  }
}
