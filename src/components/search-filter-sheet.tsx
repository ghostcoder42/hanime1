import { FILTER_TAGS, SORTS, type SortKey } from '@/lib/hanime1/types';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';

export type FilterState = {
  sortKey: SortKey | null;
  tags: string[];
  broad: boolean;
};

export const DEFAULT_FILTER: FilterState = { sortKey: null, tags: [], broad: false };

/** Count of active filter facets — for a badge on the trigger button. */
export function activeFilterCount(state: FilterState): number {
  return (state.sortKey ? 1 : 0) + state.tags.length + (state.broad ? 1 : 0);
}

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${active ? 'border-primary bg-primary' : 'border-border bg-muted'}`}
    >
      <Text className={`text-xs ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

type Props = {
  state: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
};

/**
 * Advanced search filter sheet (sort + attribute tags + broad match), presented
 * as a @gorhom/bottom-sheet so the main Browse bar stays compact. State is
 * applied live (each toggle refetches; react-query dedupes).
 */
export const SearchFilterSheet = forwardRef<BottomSheetModal, Props>(
  ({ state, onChange, onReset }, ref) => {
    const isDark = useColorScheme() === 'dark';
    const bg = isDark ? '#161616' : '#ffffff';
    const indicator = isDark ? '#52525b' : '#d4d4d8';

    const setSort = (k: SortKey | null) => onChange({ ...state, sortKey: k });
    const toggleTag = (t: string) =>
      onChange({
        ...state,
        tags: state.tags.includes(t) ? state.tags.filter((x) => x !== t) : [...state.tags, t],
      });

    const sortOptions = useMemo<[string, SortKey | null][]>(
      () => [
        ['默认', null],
        [SORTS.latestUpload, 'latestUpload'],
        [SORTS.latestRelease, 'latestRelease'],
      ],
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['68%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: bg }}
        handleIndicatorStyle={{ backgroundColor: indicator }}
        accessibilityLabel="搜索筛选"
      >
        <BottomSheetView className="flex-1">
          <View className="flex-row items-center justify-between px-5 pb-2">
            <Text className="text-lg font-bold text-foreground">筛选</Text>
            <Pressable hitSlop={8} onPress={onReset}>
              <Text className="text-sm text-muted-foreground">重置</Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 20 }}
          >
            <Section title="排序">
              {sortOptions.map(([label, key]) => (
                <Chip
                  key={label}
                  active={state.sortKey === key}
                  label={label}
                  onPress={() => setSort(key)}
                />
              ))}
            </Section>

            <Section title="标签">
              {FILTER_TAGS.map((t) => (
                <Chip
                  key={t}
                  active={state.tags.includes(t)}
                  label={t}
                  onPress={() => toggleTag(t)}
                />
              ))}
            </Section>

            <Pressable
              className="flex-row items-center justify-between rounded-xl bg-muted px-4 py-3"
              onPress={() => onChange({ ...state, broad: !state.broad })}
            >
              <Text className="text-foreground">模糊匹配</Text>
              <Text className={`text-sm ${state.broad ? 'text-primary' : 'text-muted-foreground'}`}>
                {state.broad ? '开' : '关'}
              </Text>
            </Pressable>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
SearchFilterSheet.displayName = 'SearchFilterSheet';
