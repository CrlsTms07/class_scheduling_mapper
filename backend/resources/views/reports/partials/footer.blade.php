    {{-- The official footer: small logos, the school's contacts, and the document control block. --}}
    <div class="footer">
        <table>
            <tr>
                @php($footerLogos = $footerLogos ?? [])
                @if (count($footerLogos) > 0)
                    <td class="footer-logos" width="{{ 30 * count($footerLogos) }}pt">
                        @foreach ($footerLogos as $logo)
                            <img src="{{ $logo }}" alt="">
                        @endforeach
                    </td>
                @endif
                <td class="contact">
                    {{ $school?->address }}<br>
                    @if ($school?->phone) Telephone No: {{ $school->phone }} @endif
                    @if ($school?->website) &nbsp; {{ $school->website }} @endif
                    @if ($school?->email) &nbsp; {{ $school->email }} @endif
                    @if ($school?->facebook_url)
                        <br>{{ $school->facebook_page ?? preg_replace('#^https?://(www\.)?#', '', rtrim($school->facebook_url, '/')) }}
                    @endif
                </td>
                <td align="right" width="150pt" class="control-cell">
                    <table class="control">
                        <tr>
                            <th width="58pt">Doc. Ref. Code</th>
                            <td width="52pt">{{ $settings?->doc_ref_code }}</td>
                            <th width="18pt">Rev</th>
                            <td width="20pt">{{ $settings?->revision_no }}</td>
                        </tr>
                        <tr>
                            <th>Effectivity</th>
                            <td>{{ $settings?->effectivity_date ? date('m.d.y', strtotime($settings->effectivity_date)) : '' }}</td>
                            <th>Page</th>
                            {{-- ReportService prints the page numbers in this cell, once they are known. --}}
                            <td>&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
