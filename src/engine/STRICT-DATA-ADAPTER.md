# Account-data adapter — current Ahmad schema

Entry: `prepareStrictAccountDays(persona, prices)` in `strict-data-adapter.js`.
This is an account-only, incomplete-history preparation layer. It does not
calculate zakat, read files, import Figma, or change the engine's default mode.
Nonempty holdings/manual collections are rejected rather than silently omitted.

```js
import { prepareStrictAccountDays } from './strict-data-adapter.js';
import { runEngineDetailed } from './engine.js';

const prepared = prepareStrictAccountDays(ahmad, prices);
const result = runEngineDetailed(prepared.days, { validationMode: 'strict' });
// Keep BOTH prepared.issues and result.issues for the consumer.
// prepared.readyForCalculation is false for this unverified source schema.
```

## Partial days are deliberate

Each day contains its UTC date and available saved metal prices. External
observations become deposits/withdrawals only in directions actually observed.
An absent direction/day is left absent, not certified as an empty list.
An opening credit remains an observation, not a declaration of new ownership.
The adapter never sets openingBalanceKnown or supplies a fabricated cash balance.
It does not infer bank coverage from transaction presence or date continuity.
Consequently these days are structurally consumable by Strict but do not qualify
for a complete monetary result. Do not add default fields in a downstream layer
to bypass this guard. There is no evidence override API in this version.

## Traceability and pending data

`records` retains a deep copy of every input transaction and its sourceIndex.
Disposition is one of OBSERVED_EXTERNAL_FLOW, INTERNAL_TRANSFER,
PENDING_ACCOUNT_TREATMENT, or PENDING_TRANSFER_TREATMENT.

Internal pairs match date, direction, source account, destination account and
amount. Both source indices are retained in `transfers`. They never become new
cash inflows/outflows in the consolidated wallet. Unpaired or invalid transfers
throw rather than disappear. Repeated equal transactions are retained, not
silently deduplicated; duplicate explicitly supplied transaction IDs are rejected.
No assumption is made about source ordering beyond the source's explicit dates.

Investment/unknown account types and exemption claims require review. A3 is NOT
accepted as exempt and NOT recast as ordinary cash. Its transaction is retained
as pending, outside the observed ordinary cash ledger. Transfers touching an
unresolved account are likewise pending, with a diagnostic. The adapter result
must never be described as a complete portfolio total.

## Verified current result

- 551 days with their saved prices.
- 537/537 source transactions accounted for exactly once.
- 500 observed external flow records.
- 36 internal transfer records, paired into 18 neutral transfers.
- 1 pending A3 record.
- Adapter diagnostics: OPENING_HISTORY_NOT_ESTABLISHED (A1/A2/A3),
  BANK_HISTORY_COMPLETENESS_NOT_ESTABLISHED, ACCOUNT_TREATMENT_NOT_ESTABLISHED (A3).
- Actual engine result: UNKNOWN / NEEDS_HISTORY_REVIEW, actualDue=null.
  Its facts list is openingBalanceKnown, deposits, withdrawals. This is a grouped
  first-failure diagnostic, not proof all three fields are missing on the first
  day. Both observed flow lists happen to exist on the first day; opening evidence
  is absent, and later missing directions/days remain uncertified.

Required next data: verified opening ownership history, confirmed bank-record
coverage including quiet days, and A3 classification/evidence with a supported
engine treatment. A screen cannot invent any of these. Extending this adapter
to accept verified evidence requires an explicit contract and new tests; merely
injecting openingBalanceKnown=true into the output is not a valid migration.

For the screen owner, this version is ready to demonstrate a truthful UNKNOWN
journey with traceable diagnostics, not a final Ahmad payment amount. Financial
history preparation remains the engine/data owner's responsibility.
