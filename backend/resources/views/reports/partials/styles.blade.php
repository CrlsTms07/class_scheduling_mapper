    <style>
        @font-face {
            font-family: 'Gothic';
            font-style: normal;
            font-weight: normal;
            src: url('{{ resource_path('fonts/UnifrakturMaguntia-Book.ttf') }}') format('truetype');
        }
        @page { margin: 22pt 30pt 84pt 30pt; }
        body { font-family: 'Times', 'DejaVu Serif', serif; font-size: 9pt; color: #000; }
        .watermark { position: fixed; top: 300pt; left: 110pt; font-size: 92pt; color: #000; opacity: 0.08; transform: rotate(-35deg); }

        /* The official DepEd heading. */
        .header { text-align: center; line-height: 1.15; }
        .seal { height: 46pt; margin: 0 4pt 2pt 4pt; }
        .gothic { font-family: 'Gothic', 'DejaVu Serif', serif; }
        .republic { font-size: 11pt; }
        .agency { font-size: 17pt; margin-bottom: 1pt; }
        .office { font-size: 8pt; font-weight: bold; }
        hr.rule { border: 0; border-top: 1.2pt solid #000; margin: 4pt 0 3pt 0; }
        .title { text-align: center; font-weight: bold; font-size: 11pt; line-height: 1.2; }
        .adviser { font-style: italic; }

        /* The schedule. */
        table.program { width: 100%; border-collapse: collapse; margin-top: 4pt; }
        table.program th, table.program td { border: 0.6pt solid #000; padding: 1.5pt 3pt; text-align: center; vertical-align: middle; font-size: 9pt; }
        table.program th { background: #c8c8c8; font-weight: bold; font-size: 8.5pt; }
        th.col-time { width: 52pt; }
        th.col-mins { width: 52pt; }
        td.break { background: #c8c8c8; }
        td.strong { font-weight: bold; }
        td.time { white-space: nowrap; font-size: 8pt; }
        td.minutes { width: 22pt; }
        td.spacer, th.spacer { border: 0; width: 5pt; padding: 0; background: none; }

        /* Totals, under the schedule. */
        table.totals { width: 100%; border-collapse: collapse; }
        table.totals td { border: 0.6pt solid #000; padding: 2pt 4pt; vertical-align: top; font-size: 9pt; }
        table.totals td.value { font-weight: bold; vertical-align: middle; }
        table.totals td.patterns { text-align: center; }
        table.totals .note { font-style: italic; text-align: left; }
        .note { font-style: italic; }

        /* Signatures, 2 × 2. */
        table.signatures { width: 100%; margin-top: 12pt; }
        table.signatures td { width: 50%; padding: 9pt 6pt; vertical-align: top; font-size: 9pt; }
        .signatory-name { font-weight: bold; text-transform: uppercase; }
        .signatory-position { font-style: italic; }

        /* Footer: logos, contacts and the document control block. */
        .footer { position: fixed; bottom: -66pt; left: 0; right: 0; }
        .footer table { width: 100%; border-collapse: collapse; }
        .footer-logos { vertical-align: middle; white-space: nowrap; }
        .footer-logos img { height: 24pt; margin-right: 3pt; }
        .contact { font-family: 'DejaVu Sans', sans-serif; font-size: 6.5pt; color: #111; line-height: 1.45; vertical-align: middle; padding-left: 4pt; }
        .control-cell { vertical-align: middle; }
        table.control { width: 148pt; border-collapse: collapse; font-family: 'DejaVu Sans', sans-serif; font-size: 6pt; white-space: nowrap; }
        table.control th, table.control td { border: 0.6pt solid #000; padding: 1.5pt 3pt; text-align: center; }
        table.control th { font-weight: bold; }

        /* Other reports. */
        table.grid { width: 100%; border-collapse: collapse; margin-top: 8pt; }
        table.grid th, table.grid td { border: 0.6pt solid #000; padding: 3pt 2.5pt; text-align: center; vertical-align: middle; font-size: 7pt; }
        table.grid th { background: #d0d0d0; }
        table.grid td.total { font-weight: bold; background: #eeeeee; }
        table.grid td.break { background: #c4c4c4; font-weight: bold; }
        .class-line { display: block; }
        .class-section { font-weight: bold; }
        .details { text-align: center; font-size: 8pt; margin-top: 2pt; }
        .week-total { margin-top: 6pt; font-size: 8pt; }
        table.usage { width: 100%; border-collapse: collapse; margin-top: 8pt; }
        table.usage th, table.usage td { border: 0.6pt solid #000; padding: 3pt 4pt; font-size: 7.5pt; text-align: left; vertical-align: top; }
        table.usage th { background: #d0d0d0; }
    </style>
