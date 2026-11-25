# Mission adds the React web app; prior knowledge is the Namaste React course

On 2026-11-25 the learner asked to learn how to navigate the React web app (`web/`) and confirmed adding it to [[MISSION.md]] beside the API goals (it was out of scope before). The learner states prior React knowledge at the level of the Namaste React course: components, props, `useState`, `fetch` inside `useEffect`, `react-router`, Context and Redux.

**Implications:** Do not re-teach components, props, JSX or routes. Teach by contrast with the course: the course's `useEffect` + `fetch` becomes `useQuery` / `useMutation` over `web/src/api/`; its `utils/` becomes pure `web/src/domain/`; route loaders, `useSyncExternalStore` and TanStack Query are new. Bridge map: `.scratch/research/namaste-react-to-diabe-teach-web.md`.
