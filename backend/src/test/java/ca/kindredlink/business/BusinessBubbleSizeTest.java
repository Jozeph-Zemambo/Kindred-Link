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
            1,     1.1
            10,    2.0
            49,    5.9
            50,    6.0
            51,    6.05
            99,    8.45
            100,   8.5
            101,   8.525
            199,   10.975
            200,   11.0
            201,   11.0125
            399,   13.4875
            400,   13.5
            401,   13.50625
            500,   14.125
            800,   16.0
            1000,  16.625
            1600,  18.5
            2000,  19.125
            4000,  21.625
            8000,  24.125
            16000, 26.625
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
