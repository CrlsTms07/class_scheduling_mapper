<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    @include('reports.partials.styles')
</head>
<body>
    @include('reports.partials.header')

    <div class="title">
        <div>{{ $title }}</div>
        <div>{{ $term_label }}</div>
    </div>

    <p>
        {{ $summary['issues'] }} {{ $summary['issues'] === 1 ? 'issue' : 'issues' }} in
        {{ $summary['sections_with_issues'] }} of {{ $summary['sections'] }} {{ $summary['sections'] === 1 ? 'section' : 'sections' }}.
        {{ $summary['urgent'] }} urgent, {{ $summary['not_acknowledged'] }} not yet acknowledged.
    </p>

    @if ($sections === [])
        <p>Nothing to check. Every section is clear.</p>
    @else
        <table class="usage">
            <thead>
                <tr>
                    <th>Section</th>
                    <th>Status</th>
                    <th>Level</th>
                    <th>Issue</th>
                    <th>Acknowledged</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($sections as $section)
                    @foreach ($section['issues'] as $issue)
                        <tr>
                            <td>{{ $section['label'] }}</td>
                            <td>{{ $section['status_label'] }}</td>
                            <td>{{ $issue['level'] }}</td>
                            <td>{{ $issue['message'] }}</td>
                            <td>{{ $issue['acknowledged'] ? 'Yes' : 'No' }}</td>
                        </tr>
                    @endforeach
                @endforeach
            </tbody>
        </table>
    @endif

    @php($settings = null)
    @include('reports.partials.footer')
</body>
</html>
