package ca.kindredlink.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BusinessBubbleSizeTest {

    @ParameterizedTest
    @CsvSource(textBlock = """
            0,     1.0
            1,     1.01
            100,   2.0
            499,   5.99
            500,   6.0
            501,   6.005
            999,   8.495
            1000,  8.5
            1001,  8.5025
            1999,  10.9975
            2000,  11.0
            2001,  11.00125
            4000,  13.5
            4001,  13.500625
            8000,  16.0
            16000, 18.5
            """)
    void diameterMatchesBrackets(long visitors, double expected) {
        assertEquals(expected, BusinessBubbleSize.diameterUnits(visitors), 1e-9);
    }

    @Test
    void negativeVisitorsRejected() {
        assertThrows(IllegalArgumentException.class, () -> BusinessBubbleSize.diameterUnits(-1));
        assertThrows(IllegalArgumentException.class, () -> BusinessBubbleSize.diameterUnits(Long.MIN_VALUE));
    }

    @Test
    void maxValueStaysFiniteAndMonotonic() {
        double max = BusinessBubbleSize.diameterUnits(Long.MAX_VALUE);
        assertTrue(Double.isFinite(max), "expected finite diameter for Long.MAX_VALUE, got " + max);
        assertTrue(max >= BusinessBubbleSize.diameterUnits(Long.MAX_VALUE - 1));
        assertTrue(max > BusinessBubbleSize.diameterUnits(16000));
    }
}
