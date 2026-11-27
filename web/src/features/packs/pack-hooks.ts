import type { ApiHttpError } from "../../api/http-client.ts";
import type { CurriculumPackDetail, CurriculumPackInput, CurriculumPackListItem, PackArchived, PackRegistered, PackUnarchived, PackValidation } from "../../api/packs-api.ts";
import type { NewPackDraft } from "../../domain/pack-editor.ts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archivePack, getPackById, listPacks, registerPack, unarchivePack, validatePack } from "../../api/packs-api.ts";
import { newPackInput, packVersionInput } from "../../domain/pack-editor.ts";

// The only packs file that uses TanStack Query. Screens call these hooks by what they do;
// each returns TanStack's result object (`data`, `error`, `isPending`, `mutate`, ...).

// The cache names of pack data. Everything under `packKeys.all` is refetched after a pack changes
// (archive, unarchive, and later validate/register in the Pack Editor), so every pack screen shows it.
export const packKeys = {
  all: ["packs"] as const,
  list: (includeArchived: boolean) => [
    "packs",
    "list",
    { includeArchived },
  ] as const,
  detail: (packId: string) => ["packs", "detail", packId] as const,
};

// The Pack Library: GET /api/v1/packs, with archived packs too when `includeArchived` is true.
export function usePackList(includeArchived: boolean) {
  return useQuery<CurriculumPackListItem[], ApiHttpError>({
    // The cache name: the archived and active lists are cached apart.
    queryKey: packKeys.list(includeArchived),
    // The call that fetches the list.
    queryFn: () => listPacks({ includeArchived }),
    // While "Show archived" switches lists, keep showing the previous one instead of a loading note.
    placeholderData: keepPreviousData,
  });
}

// One pack's content for Pack Detail: GET /api/v1/packs/{packId}.
export function usePack(packId: string) {
  return useQuery<CurriculumPackDetail, ApiHttpError>({
    // The cache name, per pack.
    queryKey: packKeys.detail(packId),
    // The call that fetches the pack.
    queryFn: () => getPackById(packId),
  });
}

// Read a pack's content on demand (the Pack Editor's "Copy its words"), through the same cache as
// Pack Detail. `mutate(packId)`; `data` is the pack, `error` a refusal for the screen.
export function useFetchPack() {
  const queryClient = useQueryClient();
  return useMutation<CurriculumPackDetail, ApiHttpError, string>({
    // The call `mutate(packId)` makes: the cached pack if it is fresh, else GET /api/v1/packs/{packId}.
    mutationFn: packId => queryClient.fetchQuery({
      queryKey: packKeys.detail(packId),
      queryFn: () => getPackById(packId),
    }),
  });
}

// Refetch every pack screen's data once a pack has changed.
function useRefreshPacks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: packKeys.all });
}

// Archive a pack: POST /api/v1/packs/{packId}/archive with the Account Token; then the lists refresh.
// `mutate(packId)`; `error` holds a refusal (e.g. 403 PACK_IS_SYSTEM_PACK) for the screen.
export function useArchivePack() {
  const refreshPacks = useRefreshPacks();
  return useMutation<PackArchived, ApiHttpError, string>({
    // The call `mutate(packId)` makes.
    mutationFn: archivePack,
    // Returning the refetch keeps the mutation pending until the list shows the change.
    onSuccess: refreshPacks,
  });
}

// Unarchive a pack: POST /api/v1/packs/{packId}/unarchive with the Account Token; then the lists refresh.
export function useUnarchivePack() {
  const refreshPacks = useRefreshPacks();
  return useMutation<PackUnarchived, ApiHttpError, string>({
    // The call `mutate(packId)` makes.
    mutationFn: unarchivePack,
    // Runs once the pack is unarchived: refetch the lists.
    onSuccess: refreshPacks,
  });
}

// What the Pack Editor checks or publishes: the teacher's draft, and for a new Pack Version the pack's
// current version it is built from.
export interface PackEditorDraft extends NewPackDraft {
  base?: CurriculumPackDetail;
}

// The pack a draft becomes. A new version keeps its base's id (and drops response-only fields such as
// isSystemPack). For a new pack, every pack id is read first (archived ones too, fresh, not from the
// cache) so the new id is unique, as Check pack and Publish both need.
async function draftPackInput({ base, ...draft }: PackEditorDraft): Promise<CurriculumPackInput> {
  if (base)
    return packVersionInput(draft, base);
  const library = await listPacks({ includeArchived: true });
  return newPackInput(draft, library.map(pack => pack.id));
}

// Check a draft in the Pack Editor: build the pack it would publish and POST /api/v1/packs/validate with
// the Account Token. Nothing is saved, so no pack screen refreshes. `mutate(draft)`; `data` holds
// `{ valid, errors, warnings }`, `error` a refusal.
export function useCheckPack() {
  return useMutation<PackValidation, ApiHttpError, PackEditorDraft>({
    // The calls `mutate(draft)` makes.
    mutationFn: async draft => validatePack(await draftPackInput(draft)),
  });
}

// Publish from the Pack Editor: build the pack from the draft (a new pack with a unique id, or a new
// Pack Version of `draft.base` under its id) and
// POST /api/v1/packs with the Account Token; then every pack screen refreshes. `mutate(draft)`;
// `data.packId` is the new pack's id, `data.warnings` what the validator noted.
export function usePublishPack() {
  const refreshPacks = useRefreshPacks();
  return useMutation<PackRegistered, ApiHttpError, PackEditorDraft>({
    // The calls `mutate(draft)` makes.
    mutationFn: async draft => registerPack(await draftPackInput(draft)),
    // Runs once the pack is registered: refetch the lists and the pack's detail.
    onSuccess: refreshPacks,
  });
}
