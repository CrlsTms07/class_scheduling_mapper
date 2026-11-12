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
        {{ $summary['teachers'] }} {{ $summary['teachers'] === 1 ? 'teacher' : 'teachers' }},
        {{ $summary['overloaded'] }} over their limit.
    </p>

    <table class="usage">
        <thead>
            <tr>
                <th>Teacher</th>
                <th>Department</th>
                <th>Assigned</th>
                <th>Limit</th>
                <th>Minutes per week</th>
                <th>Classes</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($teachers as $teacher)
                <tr>
                    <td>{{ $teacher['name'] }}@if ($teacher['is_overloaded'])<br><strong>Overloaded</strong>@endif</td>
                    <td>{{ $teacher['department'] }}</td>
                    <td>{{ $teacher['assigned'] }}</td>
                    <td>{{ $teacher['limit'] }}</td>
                    <td>{{ $teacher['minutes'] }}</td>
                    <td>
                        @foreach ($teacher['classes'] as $class)
                            <div>{{ $class }}</div>
                        @endforeach
                    </td>
                </tr>
            @empty
                <tr><td colspan="6">No teacher has loading yet.</td></tr>
            @endforelse
        </tbody>
    </table>

    @php($settings = null)
    @include('reports.partials.footer')
</body>
</html>
