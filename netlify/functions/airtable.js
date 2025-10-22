require("dotenv").config();
const Airtable = require('airtable');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.BASE_ID;
const TABLE_NAME = 'PromptStats';

Airtable.configure({ apiKey: AIRTABLE_API_KEY });
const base = Airtable.base(BASE_ID);

exports.handler = async function () {
  const records = [];

  return new Promise((resolve, reject) => {
    base(TABLE_NAME)
      .select({
        sort: [{ field: 'Created time', direction: 'asc' }],
        maxRecords: 100,
      })
      .eachPage(
        (fetchedRecords, fetchNextPage) => {
          records.push(
            ...fetchedRecords.map((r) => ({
              structure: r.get('Structure')?.[0]?.name || 'Unknown',
              skeleton: r.get('Skeleton') || '',
              time: r.get('Created time'),
              percentile: r.get('percentile_rank'),
              z_score: r.get('z_score'),
              trend: r.get('performance_trend'),
              rising: r.get('rising_star'),
            }))
          );
          fetchNextPage();
        },
        (err) => {
          if (err) {
            console.error(err);
            reject({
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to fetch data' }),
            });
          } else {
            resolve({
              statusCode: 200,
              body: JSON.stringify(records),
            });
          }
        }
      );
  });
};