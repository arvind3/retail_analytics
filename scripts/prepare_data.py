import json
import os
import re
import shutil
import tarfile
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path

import pandas as pd
import pyreadr

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data' / 'parquet'
PUBLIC_DIR = ROOT / 'public' / 'data'
PUBLIC_PARQUET = PUBLIC_DIR / 'parquet'

NAME_MAP = {
    'demographics': 'households',
    'transactions_sample': 'transactions',
    'campaign_desc': 'campaign_descriptions'
}


def download_completejourney() -> tuple[Path, str]:
    packages_url = 'https://cran.r-project.org/src/contrib/PACKAGES'
    packages_text = urllib.request.urlopen(packages_url, timeout=30).read().decode('utf-8')
    match = re.search(r'Package: completejourney\nVersion: ([^\n]+)\n', packages_text)
    if not match:
        raise RuntimeError('Unable to determine completejourney version from CRAN.')
    version = match.group(1).strip()
    tarball_url = f'https://cran.r-project.org/src/contrib/completejourney_{version}.tar.gz'

    temp_dir = Path(tempfile.mkdtemp())
    tarball_path = temp_dir / f'completejourney_{version}.tar.gz'
    urllib.request.urlretrieve(tarball_url, tarball_path)
    return tarball_path, version


def write_parquet(df: pd.DataFrame, path: Path) -> None:
    df.to_parquet(path, index=False)


def build_metadata(df: pd.DataFrame, parquet_path: Path) -> dict:
    columns = [{'name': col, 'type': str(df[col].dtype)} for col in df.columns]
    min_date = None
    max_date = None
    date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col])]
    if date_cols:
        date_values = pd.to_datetime(df[date_cols].stack(), errors='coerce')
        if date_values.notna().any():
            min_date = str(date_values.min().date())
            max_date = str(date_values.max().date())
    return {
        'rows': int(len(df)),
        'bytes': parquet_path.stat().st_size,
        'columns': columns,
        'min_date': min_date,
        'max_date': max_date
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    slice_weeks = os.getenv('CJ_SLICE_WEEKS')
    slice_rows = os.getenv('CJ_SLICE_ROWS')
    slice_weeks_val = int(slice_weeks) if slice_weeks else None
    slice_rows_val = int(slice_rows) if slice_rows else None

    tarball_path, version = download_completejourney()

    with tarfile.open(tarball_path, 'r:gz') as tar:
        tar.extractall(path=tarball_path.parent)

    package_root = tarball_path.parent / 'completejourney'
    data_dir = package_root / 'data'

    metadata_tables: dict[str, dict] = {}

    for rda_file in data_dir.glob('*.rda'):
        read_result = pyreadr.read_r(str(rda_file))
        for name, df in read_result.items():
            if not isinstance(df, pd.DataFrame):
                continue
            out_name = NAME_MAP.get(name, name)
            if out_name in metadata_tables and name in ('transactions_sample', 'campaign_desc'):
                continue

            df = df.copy()
            if out_name == 'transactions' and 'transaction_timestamp' in df.columns:
                df['transaction_date'] = pd.to_datetime(df['transaction_timestamp']).dt.date
                if 'week' not in df.columns:
                    df['week'] = pd.to_datetime(df['transaction_timestamp']).dt.isocalendar().week.astype(int)
                if 'day' not in df.columns:
                    min_date = pd.to_datetime(df['transaction_timestamp']).min().date()
                    df['day'] = (pd.to_datetime(df['transaction_timestamp']).dt.date - min_date).apply(lambda d: d.days)

            if out_name == 'transactions' and slice_rows_val:
                df = df.head(slice_rows_val)

            if out_name == 'transactions' and slice_weeks_val and 'week' in df.columns:
                max_week = df['week'].max()
                df = df[df['week'] >= (max_week - slice_weeks_val)]

            out_path = DATA_DIR / f'{out_name}.parquet'
            write_parquet(df, out_path)
            metadata_tables[out_name] = build_metadata(df, out_path)

    metadata = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'source': f'completejourney {version}',
        'tables': metadata_tables,
        'total_bytes': int(sum(item['bytes'] for item in metadata_tables.values()))
    }

    metadata_path = ROOT / 'data' / 'metadata.json'
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    PUBLIC_PARQUET.mkdir(parents=True, exist_ok=True)
    shutil.copy(metadata_path, PUBLIC_DIR / 'metadata.json')
    for parquet_file in DATA_DIR.glob('*.parquet'):
        shutil.copy(parquet_file, PUBLIC_PARQUET / parquet_file.name)

    shutil.rmtree(tarball_path.parent, ignore_errors=True)


if __name__ == '__main__':
    main()
