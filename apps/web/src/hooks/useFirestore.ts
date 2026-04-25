// Real-time Firestore hooks that handle anonymous auth, snapshot subscriptions,
// and cleanup automatically. Use these instead of calling onSnapshot directly —
// they guard against Firestore permission errors that occur when the component
// mounts before authentication completes.
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  type Query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb, ensureAnonymousAuth } from '@/lib/firebase';

interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

interface UseDocumentResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Real-time collection listener
export function useCollection<T extends DocumentData>(
  collectionPath: string,
  ...constraints: QueryConstraint[]
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // QueryConstraint objects are recreated on every render, so they can't be used
  // as useEffect deps directly. Stringifying their type names gives a stable key
  // that only changes when the actual query shape changes.
  const constraintKey = JSON.stringify(constraints.map((c) => c.type));

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void ensureAnonymousAuth().then(() => {
      if (cancelled) return;
      const db = getDb();
      const q: Query<DocumentData> = query(collection(db, collectionPath), ...constraints);

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
          setData(items);
          setLoading(false);
          setError(null);
        },
        (err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        },
      );
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [collectionPath, constraintKey]);

  return { data, loading, error };
}

// Real-time document listener
export function useDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string | null,
): UseDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void ensureAnonymousAuth().then(() => {
      if (cancelled) return;
      const db = getDb();
      unsubRef.current = onSnapshot(
        doc(db, collectionPath, docId),
        (snap) => {
          setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as T) : null);
          setLoading(false);
        },
        (err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        },
      );
    });

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [collectionPath, docId]);

  return { data, loading, error };
}
