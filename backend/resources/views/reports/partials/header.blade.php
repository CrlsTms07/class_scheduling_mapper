    <div class="header">
        @foreach ($logos as $logo)
            <img class="logo" src="{{ $logo }}" alt="">
        @endforeach
        <div class="school-name">{{ $school?->school_name }}</div>
        <div class="address">{{ $school?->address }}</div>
    </div>
    <hr>
