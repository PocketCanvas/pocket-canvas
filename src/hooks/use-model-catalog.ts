import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadModels, type StoredModel } from '@/lib/model-files';

export function useModelCatalog(onModelsLoaded: (models: StoredModel[]) => void) {
  const [models, setModels] = useState<StoredModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadModels()
        .then((loadedModels) => {
          setError(null);
          setModels(loadedModels);
          onModelsLoaded(loadedModels);
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : '모델 목록을 불러오지 못했습니다.'),
        );
    }, [onModelsLoaded]),
  );

  return { models, error };
}
