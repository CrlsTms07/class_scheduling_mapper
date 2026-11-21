    {{-- Senior High: one row of three, as on its form (Prepared by, Noted by, Approved by): the label,
         the name in capitals, and the position under it. --}}
    @if (count($signatories) === 3)
        <table class="signatures">
            <tr>
                @foreach ($signatories as $signatory)
                    <td style="width: 33%; text-align: center; vertical-align: top;">
                        <div>{{ $signatory['label'] }}:</div>
                        <div style="margin-top: 14px; font-weight: bold;">{{ mb_strtoupper((string) $signatory['name']) }}</div>
                        @if ($signatory['position'])
                            <div>{{ $signatory['position'] }}</div>
                        @endif
                    </td>
                @endforeach
            </tr>
        </table>
    @else
    {{-- 2 × 2, filled down then across as on the school's form: Prepared by and Conforme on the
         left, Recommending Approval and Approved by on the right (in their sort order). --}}
    @php
        $half = (int) ceil(count($signatories) / 2);
        $left = array_slice($signatories, 0, $half);
        $right = array_slice($signatories, $half);
    @endphp
    <table class="signatures">
        @for ($i = 0; $i < $half; $i++)
            <tr>
                @foreach ([$left[$i] ?? null, $right[$i] ?? null] as $signatory)
                    <td>
                        @if ($signatory)
                            {{ $signatory['label'] }}:&nbsp;
                            <span class="signatory-name">{{ $signatory['name'] }}</span>@if ($signatory['position']),
                                <span class="signatory-position">{{ $signatory['position'] }}</span>@endif
                        @endif
                    </td>
                @endforeach
            </tr>
        @endfor
    </table>
    @endif
