    <table class="signatures">
        @foreach (array_chunk($signatories, 2) as $pair)
            <tr>
                @foreach ($pair as $signatory)
                    <td>
                        {{ $signatory['label'] }}:
                        <span class="signatory-name">{{ $signatory['name'] }}</span>@if ($signatory['position']),
                            <span class="signatory-position">{{ $signatory['position'] }}</span>@endif
                    </td>
                @endforeach
            </tr>
        @endforeach
    </table>
