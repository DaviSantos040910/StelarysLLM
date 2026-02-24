import client from '../api/client';
import { User } from '../types/auth';
import { validateFile } from '../utils/fileValidation';

export interface UpdateProfileData {
    first_name?: string;
    last_name?: string;
    avatar?: any;
}

export interface ChangePasswordData {
    old_password: string;
    new_password: string;
}

export const userService = {
    async getProfile(): Promise<User> {
        const response = await client.get<User>('/api/v1/accounts/me/');
        return response.data;
    },

    async updateProfile(data: UpdateProfileData): Promise<User> {
        const formData = new FormData();
        if (data.first_name) formData.append('first_name', data.first_name);
        if (data.last_name) formData.append('last_name', data.last_name);

        if (data.avatar && data.avatar.uri) {
            // Validate avatar before upload
            const validationError = validateFile(data.avatar);
            if (validationError) throw new Error(validationError);

            formData.append('avatar', {
                uri: data.avatar.uri,
                name: data.avatar.name || 'avatar.jpg',
                type: data.avatar.type || 'image/jpeg',
            } as any);
        }

        const response = await client.patch<User>('/api/v1/accounts/me/', formData);
        return response.data;
    },

    async changePassword(data: ChangePasswordData): Promise<void> {
        await client.post('/api/v1/accounts/change_password/', data);
    },

    async deleteAccount(): Promise<void> {
        await client.delete('/api/v1/accounts/me/');
    }
};
