<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    @include('reports.partials.styles')
</head>
<body>
    @if ($isDraft)
        <div class="watermark">DRAFT</div>
    @endif

    @include('reports.partials.header')

    <div class="title">
        <div>{{ $title }}</div>
        <div>{{ $term_label }}</div>
    </div>

    @forelse ($tables as $table)
        {{-- A table never starts at the foot of a page and goes on to the next. --}}
        <p @unless ($loop->first) style="page-break-before: always;" @endunless><strong>{{ $table['name'] }}</strong></p>
        <table class="grid">
            <thead>
                <tr>
                    <th width="13%">TIME</th>
                    <th width="5%">MINS</th>
                    @foreach ($table['sections'] as $section)
                        <th>{{ mb_strtoupper($section['label']) }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach ($table['rows'] as $row)
                    <tr>
                        <td>{{ $row['time'] }}</td>
                        <td>{{ $row['minutes'] }}</td>
                        @if ($row['break'] !== null)
                            <td class="break" colspan="{{ count($table['sections']) }}">{{ $row['break'] }}</td>
                        @else
                            @foreach ($table['sections'] as $section)
                                <td>
                                    @foreach ($row['cells'][$section['id']] as $group)
                                        <span class="class-line class-section">{{ $group['subject'] }}@if ($group['days']) ({{ $group['days'] }})@endif</span>
                                        <span class="class-line">{{ $group['teacher'] }}</span>
                                        <span class="class-line">{{ $group['room'] }}</span>
                                    @endforeach
                                </td>
                            @endforeach
                        @endif
                    </tr>
                @endforeach
            </tbody>
        </table>
    @empty
        <p>This grade has no sections with a bell schedule yet.</p>
    @endforelse

    @php($settings = null)
    @include('reports.partials.footer')
</body>
</html>
