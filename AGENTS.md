<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls live only in `src/lib/chat.server.ts` (model constant there) behind `/api/chat`; limits in `src/lib/limits.ts` are enforced server-side — keeps keys and quotas off the client.
- Signed-in pages live under `src/routes/_authenticated/app.*`; unfinished areas render `NotBuilt` instead of fake controls.
- Billing uses one browser-safe catalogue as server-authoritative configuration; payment and entitlement allowance snapshots preserve existing purchases when the catalogue changes.
- All AI entry points reserve usage atomically through a service-only database function before calling AI; India calendar-day boundaries prevent concurrent and workflow quota bypasses.
