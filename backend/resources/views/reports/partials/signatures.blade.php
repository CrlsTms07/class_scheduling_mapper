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
