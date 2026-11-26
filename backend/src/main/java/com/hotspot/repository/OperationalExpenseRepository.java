package com.hotspot.repository;

import com.hotspot.domain.OperationalExpense;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationalExpenseRepository extends JpaRepository<OperationalExpense, Long> {
}
