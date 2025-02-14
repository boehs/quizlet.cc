import type { Term } from "@prisma/client";
import React from "react";
import { RootFlashcardContext } from "../components/root-flashcard-wrapper";
import { queryEventChannel } from "../events/query";
import { useSetFolderUnison } from "../hooks/use-set-folder-unison";
import type { StudiableTerm } from "../interfaces/studiable-term";
import { useExperienceContext } from "../stores/use-experience-store";
import {
  createSortFlashcardsStore,
  SortFlashcardsContext,
  type SortFlashcardsStore,
} from "../stores/use-sort-flashcards-store";
import type { FolderData } from "./hydrate-folder-data";
import type { SetData } from "./hydrate-set-data";

export const CreateSortFlashcardsData: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { terms, experience } = useSetFolderUnison();
  const { termOrder } = React.useContext(RootFlashcardContext);
  const starredTerms = useExperienceContext((s) => s.starredTerms);
  const storeRef = React.useRef<SortFlashcardsStore>();

  const initState = (
    round: number,
    studiableTerms: Pick<
      StudiableTerm,
      "id" | "correctness" | "appearedInRound" | "incorrectCount"
    >[],
    terms: Term[],
    termOrder: string[],
    studyStarred: boolean
  ) => {
    let flashcardTerms: StudiableTerm[] = termOrder.map((id) => {
      const term = terms.find((t) => t.id === id)!;
      const studiableTerm = studiableTerms.find((s) => s.id === term.id);
      return {
        ...term,
        correctness: studiableTerm?.correctness ?? 0,
        appearedInRound: studiableTerm?.appearedInRound ?? undefined,
        incorrectCount: studiableTerm?.incorrectCount ?? 0,
      };
    });

    if (studyStarred) {
      flashcardTerms = flashcardTerms.filter((x) =>
        starredTerms.includes(x.id)
      );
    }

    storeRef.current!.getState().initialize(round, flashcardTerms, terms);
  };

  if (!storeRef.current) {
    storeRef.current = createSortFlashcardsStore();
    initState(
      experience.cardsRound,
      experience.studiableTerms.filter((x) => x.mode == "Flashcards"),
      terms,
      termOrder,
      experience.cardsStudyStarred
    );
  }

  React.useEffect(() => {
    const trigger = (data: SetData | FolderData) =>
      initState(
        data.experience.cardsRound,
        data.experience.studiableTerms.filter((x) => x.mode == "Flashcards"),
        data.terms,
        termOrder,
        data.experience.cardsStudyStarred
      );

    queryEventChannel.on("setQueryRefetched", trigger);
    queryEventChannel.on("folderQueryRefetched", trigger);
    return () => {
      queryEventChannel.off("setQueryRefetched", trigger);
      queryEventChannel.off("folderQueryRefetched", trigger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SortFlashcardsContext.Provider value={storeRef.current}>
      {children}
    </SortFlashcardsContext.Provider>
  );
};
