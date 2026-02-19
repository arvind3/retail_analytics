import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data' / 'parquet'
META_PATH = ROOT / 'data' / 'metadata.json'


def fail(message: str) -> None:
    print(f'ERROR: {message}')
    sys.exit(1)


def load_table(name: str) -> pd.DataFrame:
    path = DATA_DIR / f'{name}.parquet'
    if not path.exists():
        fail(f'Missing parquet file: {path}')
    return pd.read_parquet(path)


if not META_PATH.exists():
    fail('Missing data/metadata.json. Run scripts/prepare_data.R to generate data.')

with META_PATH.open('r', encoding='utf-8') as handle:
    metadata = json.load(handle)

required_tables = ['transactions', 'products', 'households']
for table in required_tables:
    if table not in metadata.get('tables', {}):
        fail(f'Metadata missing table entry: {table}')

transactions = load_table('transactions')
products = load_table('products')
households = load_table('households')

if transactions.empty:
    fail('Transactions table has no rows.')
if products.empty:
    fail('Products table has no rows.')
if households.empty:
    fail('Households table has no rows.')

if 'product_id' in products.columns:
    if products['product_id'].duplicated().any():
        fail('Products.product_id has duplicates.')

if 'product_id' in transactions.columns and 'product_id' in products.columns:
    missing_products = set(transactions['product_id']) - set(products['product_id'])
    if missing_products:
        fail('Transactions contain product_id values not found in products.')

for col in transactions.columns:
    if 'date' in col or 'timestamp' in col:
        parsed = pd.to_datetime(transactions[col], errors='coerce')
        if parsed.notna().sum() == 0:
            fail(f'Date column {col} could not be parsed.')
        if parsed.min() > parsed.max():
            fail(f'Date column {col} has invalid range.')

if 'week' in transactions.columns:
    if (transactions['week'] < 0).any():
        fail('Transactions.week has negative values.')

if 'day' in transactions.columns:
    if (transactions['day'] < 0).any():
        fail('Transactions.day has negative values.')

coupon_redemptions_path = DATA_DIR / 'coupon_redemptions.parquet'
coupons_path = DATA_DIR / 'coupons.parquet'
if coupon_redemptions_path.exists() and coupons_path.exists():
    redemptions = pd.read_parquet(coupon_redemptions_path)
    coupons = pd.read_parquet(coupons_path)
    if {'coupon_upc', 'campaign_id'}.issubset(redemptions.columns) and {
        'coupon_upc',
        'campaign_id'
    }.issubset(coupons.columns):
        merged = redemptions.merge(
            coupons[['coupon_upc', 'campaign_id']].drop_duplicates(),
            on=['coupon_upc', 'campaign_id'],
            how='left',
            indicator=True,
        )
        if (merged['_merge'] == 'left_only').any():
            fail('Coupon redemptions reference missing coupons.')

print('Data validation passed.')
