<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 26pt 28pt 92pt 28pt; }
        body { font-family: 'DejaVu Serif', serif; font-size: 8pt; color: #000; }
        .watermark { position: fixed; top: 300pt; left: 110pt; font-size: 92pt; color: #000; opacity: 0.08; transform: rotate(-35deg); }
        .header { text-align: center; }
        .logo { height: 50pt; }
        .school-name { font-size: 11pt; font-weight: bold; margin-top: 3pt; }
        .address { font-size: 7.5pt; }
        hr { border: 0; border-top: 1pt solid #000; margin: 5pt 0; }
        .title { text-align: center; font-weight: bold; font-size: 10pt; line-height: 1.35; }
        .adviser { font-style: italic; }
        table.program { width: 100%; border-collapse: collapse; margin-top: 8pt; }
        table.program th, table.program td { border: 0.6pt solid #000; padding: 3pt 2.5pt; text-align: center; vertical-align: middle; }
        table.program th { background: #d0d0d0; font-size: 7pt; }
        td.time { white-space: nowrap; font-size: 7.5pt; }
        td.minutes { width: 22pt; }
        td.break { background: #c4c4c4; font-weight: bold; }
        td.spacer, th.spacer { border: 0; width: 5pt; padding: 0; background: none; }
        table.totals { width: 100%; border-collapse: collapse; margin-top: 6pt; }
        table.totals td { border: 0.6pt solid #000; padding: 3pt 4pt; }
        .note { font-style: italic; }
        table.signatures { width: 100%; margin-top: 12pt; }
        table.signatures td { width: 50%; padding: 7pt 4pt; vertical-align: top; font-size: 8.5pt; }
        .signatory-name { font-weight: bold; text-transform: uppercase; }
        .signatory-position { font-style: italic; }
        .footer { position: fixed; bottom: -72pt; left: 0; right: 0; }
        .footer table { width: 100%; border-collapse: collapse; }
        .contact { font-size: 7pt; color: #333; line-height: 1.4; vertical-align: top; }
        table.control { width: 174pt; border-collapse: collapse; font-size: 6.5pt; white-space: nowrap; }
        table.control td { border: 0.5pt solid #555; padding: 2pt 3pt; }
    </style>
</head>
<body>
    @if ($isDraft)
        <div class="watermark">DRAFT</div>
    @endif

    <div class="header">
        @foreach ($logos as $logo)
            <img class="logo" src="{{ $logo }}" alt="">
        @endforeach
        <div class="school-name">{{ $school?->school_name }}</div>
        <div class="address">{{ $school?->address }}</div>
    </div>
    <hr>

    <div class="title">
        <div>{{ $title }}</div>
        <div>{{ $term->name }}, School Year {{ $term->schoolYear->name }}</div>
        <div>GRADE {{ $section->gradeLevel->grade }} – {{ mb_strtoupper($section->name) }}</div>
        <div>Class Adviser: <span class="adviser">{{ $adviser ?? '' }}</span></div>
    </div>

    @php($rowCount = collect($blocks)->max(fn ($block) => count($block['rows'])) ?? 0)

    <table class="program">
        <thead>
            <tr>
                @foreach ($blocks as $block)
                    @if (! $loop->first)
                        <th class="spacer"></th>
                    @endif
                    <th>TIME</th>
                    <th>No. of Mins.</th>
                    <th>{{ mb_strtoupper($block['name']) }}</th>
                    <th>TEACHER</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @for ($index = 0; $index < $rowCount; $index++)
                <tr>
                    @foreach ($blocks as $block)
                        @php($row = $block['rows'][$index] ?? null)
                        @if (! $loop->first)
                            <td class="spacer"></td>
                        @endif
                        @if ($row === null)
                            <td></td><td></td><td></td><td></td>
                        @elseif ($row['is_break'])
                            <td class="time break">{{ $row['time'] }}</td>
                            <td class="minutes break">{{ $row['minutes'] }}</td>
                            <td class="break" colspan="2">{{ $row['subject'] }}</td>
                        @else
                            <td class="time">{{ $row['time'] }}</td>
                            <td class="minutes">{{ $row['minutes'] }}</td>
                            <td>{{ $row['subject'] }}</td>
                            <td>{{ $row['teacher'] }}</td>
                        @endif
                    @endforeach
                </tr>
            @endfor
        </tbody>
    </table>

    <table class="totals">
        @foreach ($blocks as $block)
            <tr>
                <td width="24%">{{ $block['name'] }}</td>
                <td>
                    Total per day: <strong>{{ $block['total_minutes'] }} minutes</strong> ({{ $block['duration'] }}),
                    of which {{ $block['class_minutes'] }} minutes are class time
                </td>
            </tr>
        @endforeach
        @if ($settings?->reference_note)
            <tr>
                <td colspan="2" class="note">{{ $settings->reference_note }}</td>
            </tr>
        @endif
    </table>

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
</body>
</html>
