import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { exportToCSV, exportToJSON, formatDateForFilename, excelText } from './exportUtils';

describe('exportUtils', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createObjectURLMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let revokeObjectURLMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createElementMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let removeChildMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    createObjectURLMock = vi.fn();
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
    createObjectURLMock.mockReturnValue('blob:test-url');

    createElementMock = vi.spyOn(document, 'createElement');
    appendChildMock = vi.spyOn(document.body, 'appendChild');
    removeChildMock = vi.spyOn(document.body, 'removeChild');

    appendChildMock.mockImplementation((node: unknown) => node);
    removeChildMock.mockImplementation((node: unknown) => node);
  });

  const originalCreateObjectURL = global.URL.createObjectURL;
  const originalRevokeObjectURL = global.URL.revokeObjectURL;

  afterEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('formatDateForFilename', () => {
    it('should format date correctly', () => {
      const date = new Date(2023, 0, 15, 12, 30, 45); // Jan 15, 2023 12:30:45
      const formatted = formatDateForFilename(date);
      expect(formatted).toBe('20230115_123045');
    });

    it('should handle single digit months/days/times', () => {
      const date = new Date(2023, 8, 5, 9, 5, 5); // Sep 5, 2023 09:05:05
      const formatted = formatDateForFilename(date);
      expect(formatted).toBe('20230905_090505');
    });

    it('should use current date if no argument provided', () => {
        const formatted = formatDateForFilename();
        // Just check the format structure roughly as time moves
        expect(formatted).toMatch(/^\d{8}_\d{6}$/);
    });
  });

  const readBlob = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  };

  describe('exportToCSV', () => {
    it('should return error if data is empty', () => {
      const result = exportToCSV([], 'test.csv');
      expect(result).toEqual({ success: false, error: 'エクスポートするデータがありません' });
      expect(createObjectURLMock).not.toHaveBeenCalled();
    });

    it('should export valid data to CSV', async () => {
      const data = [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
      ];

      const linkClickMock = vi.fn();
      createElementMock.mockReturnValue({
        click: linkClickMock,
        href: '',
        download: '',
        style: {},
      } as unknown as HTMLElement);

      const result = exportToCSV(data, 'test.csv');

      expect(result).toEqual({ success: true });
      expect(createObjectURLMock).toHaveBeenCalled();

      // Check Blob content
      const blob = createObjectURLMock.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      const text = await readBlob(blob);

      // Note: FileReader.readAsText might consume BOM or it might be present.
      // In JSDOM/Node environment, it seems to be handled/stripped or we should check if present.
      // Based on previous run, BOM was stripped (text started with 'id').
      // So we just check the content directly.

      const lines = text.split('\n');
      expect(lines[0]).toBe('id,name,active');
      expect(lines[1]).toBe('1,Alice,true');
      expect(lines[2]).toBe('2,Bob,false');

      // Check download trigger
      expect(createElementMock).toHaveBeenCalledWith('a');
      expect(appendChildMock).toHaveBeenCalled();
      expect(linkClickMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
    });

    it('should handle custom headers', async () => {
        const data = [{ id: 1, name: 'Alice' }];
        const headers = { id: 'ID', name: '名前' };

        exportToCSV(data, 'test.csv', headers);

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);
        expect(text.split('\n')[0]).toBe('ID,名前');
    });

    it('should escape CSV special characters', async () => {
        const data = [
            { id: 1, note: 'Hello, World' }, // comma
            { id: 2, note: 'Line\nBreak' }, // newline
            { id: 3, note: 'Say "Hi"' },    // double quote
        ];

        exportToCSV(data, 'escape.csv');

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);

        expect(text).toContain('1,"Hello, World"');
        expect(text).toContain('2,"Line\nBreak"');
        expect(text).toContain('3,"Say ""Hi"""');
    });

    it('should handle null/undefined values', async () => {
        const data = [{ id: 1, value: null }, { id: 2, value: undefined }];
        exportToCSV(data, 'nulls.csv');

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);
        const lines = text.split('\n');

        expect(lines[1]).toBe('1,');
        expect(lines[2]).toBe('2,');
    });

    it('should handle object values (stringify)', async () => {
        const data = [{ id: 1, meta: { key: 'value' } }];
        exportToCSV(data, 'objects.csv');

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);
        const lines = text.split('\n');

        // JSON stringified and escaped
        expect(lines[1]).toBe('1,"{""key"":""value""}"');
    });

    it('should wrap excelText values so Excel treats them as literal text, not auto-converted dates', async () => {
        const data = [{ id: 1, 日時: excelText('8/7 09:05:20') }];
        exportToCSV(data, 'dates.csv');

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);
        const lines = text.split('\n');

        expect(lines[1]).toBe('1,"=""8/7 09:05:20"""');
    });

    it('should escape embedded quotes inside excelText values', async () => {
        const data = [{ id: 1, note: excelText('Say "Hi"') }];
        exportToCSV(data, 'dates2.csv');

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        const text = await readBlob(blob);
        const lines = text.split('\n');

        expect(lines[1]).toBe('1,"=""Say ""Hi"""""');
    });

    it('should return error if blob creation fails (simulation)', () => {
       createObjectURLMock.mockImplementation(() => {
           throw new Error('Blob Error');
       });

       const data = [{ id: 1 }];
       const result = exportToCSV(data, 'fail.csv');
       expect(result).toEqual({ success: false, error: 'エクスポートに失敗しました' });
    });
  });

  describe('exportToJSON', () => {
    it('should return error if data is empty', () => {
        const result = exportToJSON([], 'test.json');
        expect(result).toEqual({ success: false, error: 'エクスポートするデータがありません' });
    });

    it('should export valid data to JSON', async () => {
        const data = [{ id: 1, name: 'Alice' }];

        const linkClickMock = vi.fn();
        createElementMock.mockReturnValue({
            click: linkClickMock,
            href: '',
            download: '',
            style: {},
        } as unknown as HTMLElement);

        const result = exportToJSON(data, 'test.json');

        expect(result).toEqual({ success: true });

        const blob = createObjectURLMock.mock.calls[0][0] as Blob;
        expect(blob.type).toContain('application/json');

        const text = await readBlob(blob);
        const json = JSON.parse(text);
        expect(json).toEqual(data);

        expect(linkClickMock).toHaveBeenCalled();
    });

    it('should return error on failure', () => {
        createObjectURLMock.mockImplementation(() => {
            throw new Error('Blob Error');
        });
        const data = [{ id: 1 }];
        const result = exportToJSON(data, 'fail.json');
        expect(result).toEqual({ success: false, error: 'エクスポートに失敗しました' });
    });
  });
});
