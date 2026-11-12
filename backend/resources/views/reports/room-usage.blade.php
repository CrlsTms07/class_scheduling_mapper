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

    <table class="usage">
        <thead>
            <tr>
                <th>Building</th>
                <th>Room</th>
                <th>Sections (periods per week)</th>
                <th>Periods per week</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($buildings as $building)
                @foreach ($building['rooms'] as $room)
                    <tr>
                        <td>{{ $building['name'] }}</td>
                        <td>{{ $room['room_number'] }}@if ($room['room_name']) – {{ $room['room_name'] }}@endif</td>
                        <td>
                            @forelse ($room['sections'] as $section)
                                <div>{{ $section['label'] }} ({{ $section['periods_per_week'] }})</div>
                            @empty
                                Not used
                            @endforelse
                        </td>
                        <td>{{ $room['periods_per_week'] }}</td>
                    </tr>
                @endforeach
            @endforeach
        </tbody>
    </table>

    @php($settings = null)
    @include('reports.partials.footer')
</body>
</html>
