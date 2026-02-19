export type TableMetadata = {
  rows: number;
  bytes: number;
  columns: { name: string; type: string }[];
  min_date?: string;
  max_date?: string;
};

export type DatasetMetadata = {
  generated_at: string;
  source: string;
  tables: Record<string, TableMetadata>;
  total_bytes: number;
};

let metadataPromise: Promise<DatasetMetadata> | null = null;

export const getMetadata = async () => {
  if (!metadataPromise) {
    metadataPromise = fetch(`${import.meta.env.BASE_URL}data/metadata.json`)
      .then((res) => res.json())
      .catch(() => ({
        generated_at: new Date().toISOString(),
        source: 'unknown',
        tables: {},
        total_bytes: 0
      }));
  }
  return metadataPromise;
};

export const getTableBytes = async (table: string) => {
  const metadata = await getMetadata();
  return metadata.tables?.[table]?.bytes ?? 0;
};
