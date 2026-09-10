-- Spec #54: database-computable Player_Safe_Source_Reference ordering for
-- bounded Finance Center event pages. The supplied secret is a query parameter;
-- it is neither retained nor exposed by this function.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION finance_report_source_reference(
  stable_user_id INTEGER,
  report_season_number INTEGER,
  source_identity TEXT,
  reference_secret TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 'FIN-' || LEFT(
    TRANSLATE(
      RTRIM(
        ENCODE(
          HMAC(
            CONVERT_TO('finance-report-v1', 'UTF8')
            || DECODE('00', 'hex')
            || CONVERT_TO(stable_user_id::TEXT, 'UTF8')
            || DECODE('00', 'hex')
            || CONVERT_TO(report_season_number::TEXT, 'UTF8')
            || DECODE('00', 'hex')
            || CONVERT_TO(source_identity, 'UTF8'),
            CONVERT_TO(reference_secret, 'UTF8'),
            'sha256'
          ),
          'base64'
        ),
        '='
      ),
      '+/',
      '-_'
    ),
    22
  );
$$;
