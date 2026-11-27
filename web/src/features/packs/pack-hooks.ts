import type { ApiHttpError } from "../../api/http-client.ts";
import type { CurriculumPackDetail, CurriculumPackListItem, PackArchived, PackRegistered, PackUnarchived } from "../../api/packs-api.ts";
import type { NewPackDraft } from "../../domain/pack-editor.ts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archivePack, getPackById, listPacks, registerPack, unarchivePack } from "../../api/packs-api.ts";
import { newPackInput } from "../../domain/pack-editor.ts";

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

// Publish a new pack from the Pack Editor: read every pack id (archived ones too, so the new id is
// unique), build the pack from the draft, and POST /api/v1/packs with the Account Token; then every pack
// screen refreshes. `mutate(draft)`; `data.packId` is the new pack's id.
export function usePublishPack() {
  const refreshPacks = useRefreshPacks();
  return useMutation<PackRegistered, ApiHttpError, NewPackDraft>({
    // The calls `mutate(draft)` makes.
    mutationFn: async (draft) => {
      const library = await listPacks({ includeArchived: true });
      return registerPack(newPackInput(draft, library.map(pack => pack.id)));
    },
    // Runs once the pack is registered: refetch the lists and the pack's detail.
    onSuccess: refreshPacks,
  });
}
