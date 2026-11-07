<?php

namespace App\Http\Requests;

use App\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-school-records');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'room_number' => ['required', 'string', 'max:20'],
            'room_name' => ['nullable', 'string', 'max:80'],
            'capacity' => ['nullable', 'integer', 'between:0,500'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    /**
     * Room numbers repeat across buildings, but not inside one.
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->has('room_number')) {
                return;
            }

            $editing = $this->route('room');
            $buildingId = $editing?->building_id ?? $this->route('building')->id;

            $taken = Room::where('building_id', $buildingId)
                ->whereRaw('LOWER(room_number) = LOWER(?)', [trim($this->input('room_number'))])
                ->when($editing, fn ($query) => $query->whereKeyNot($editing->id))
                ->exists();

            if ($taken) {
                $validator->errors()->add('room_number', 'This building already has a room with this number.');
            }
        }];
    }
}
