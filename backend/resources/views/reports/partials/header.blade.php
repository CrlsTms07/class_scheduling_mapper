    {{-- The official DepEd heading: the seal, then the agency and school lines. --}}
    <div class="header">
        @foreach ($headerLogos ?? $logos ?? [] as $logo)
            <img class="seal" src="{{ $logo }}" alt="">
        @endforeach
        <div class="gothic republic">Republic of the Philippines</div>
        <div class="gothic agency">Department of Education</div>
        @php($region = $school?->region ?: config('school.region'))
        @php($division = $school?->division ?: config('school.division'))
        @if ($region)
            <div class="office">{{ $region }}</div>
        @endif
        @if ($division)
            <div class="office">{{ mb_strtoupper($division) }}</div>
        @endif
        <div class="office">{{ mb_strtoupper((string) $school?->school_name) }}</div>
        @if ($school?->address)
            <div class="office">{{ mb_strtoupper($school->address) }}</div>
        @endif
    </div>
    <hr class="rule">
