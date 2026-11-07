    <div class="footer">
        <table>
            <tr>
                <td class="contact">
                    {{ $school?->address }}<br>
                    @if ($school?->phone) Telephone No: {{ $school->phone }}<br> @endif
                    {{ $school?->website }} @if ($school?->website && $school?->email) · @endif {{ $school?->email }}
                </td>
                <td align="right" width="176pt">
                    <table class="control">
                        <tr>
                            <td width="56pt">Doc. Ref. Code</td>
                            <td width="56pt">{{ $settings?->doc_ref_code }}</td>
                            <td width="20pt">Rev</td>
                            <td width="28pt">{{ $settings?->revision_no }}</td>
                        </tr>
                        <tr>
                            <td>Effectivity</td>
                            <td>{{ $settings?->effectivity_date ? date('m.d.y', strtotime($settings->effectivity_date)) : '' }}</td>
                            <td>Page</td>
                            {{-- ReportService prints the page numbers in this cell, once they are known. --}}
                            <td>&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
